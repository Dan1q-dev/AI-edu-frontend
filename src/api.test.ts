import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

const fetchMock = vi.fn<typeof fetch>()
function response(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), { status })
}

beforeEach(() => {
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'csrftoken=; Max-Age=0; path=/' })

describe('session API and CSRF', () => {
  it('shares CSRF initialization between concurrent requests', async () => {
    let complete!: () => void
    fetchMock.mockImplementation(async url => {
      if (url === '/api/v1/csrf/') return new Promise(resolve => {
        complete = () => { document.cookie = 'csrftoken=initial; path=/'; resolve(response({})) }
      })
      return response({}, 204)
    })
    const first = api('auth/logout/', 'POST')
    const second = api('auth/logout/', 'POST')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    complete()
    await Promise.all([first, second])
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/csrf/')).toHaveLength(1)
    expect(fetchMock.mock.calls.slice(1).every(([, options]) => (options?.headers as Record<string, string>)['X-CSRFToken'] === 'initial')).toBe(true)
  })

  it.each([
    ['csrf_failed', 'CSRF token is missing or invalid'],
    ['permission_denied', { detail: 'CSRF Failed: CSRF token from the header incorrect.' }],
  ])('refreshes a rejected CSRF token once for %s', async (code, detail) => {
    document.cookie = 'csrftoken=old; path=/'
    const tokens: string[] = []
    fetchMock.mockImplementation(async (url, options) => {
      if (url === '/api/v1/csrf/') { document.cookie = 'csrftoken=new; path=/'; return response({}) }
      tokens.push((options?.headers as Record<string, string>)['X-CSRFToken'])
      return tokens.length === 1 ? response({ error: { code, detail } }, 403) : response({}, 204)
    })
    await expect(api('auth/logout/', 'POST')).resolves.toBeUndefined()
    expect(tokens).toEqual(['old', 'new'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stops after the second CSRF failure', async () => {
    document.cookie = 'csrftoken=old; path=/'
    fetchMock.mockImplementation(async url => url === '/api/v1/csrf/' ? response({}) : response({ error: { code: 'csrf_failed', detail: 'Invalid CSRF' } }, 403))
    await expect(api('auth/logout/', 'POST')).rejects.toMatchObject({ status: 403, code: 'csrf_failed' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry permission errors', async () => {
    document.cookie = 'csrftoken=valid; path=/'
    fetchMock.mockResolvedValue(response({ error: { code: 'permission_denied', detail: 'Access denied' } }, 403))
    await expect(api('admin/users/', 'POST', {})).rejects.toMatchObject({ status: 403, code: 'permission_denied', message: 'Access denied' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not send a mutation when CSRF initialization fails and allows retry', async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: 'Server unavailable' }, 503))
    await expect(api('auth/login/', 'POST', {})).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockImplementation(async url => {
      if (url === '/api/v1/csrf/') document.cookie = 'csrftoken=valid; path=/'
      return response({})
    })
    await expect(api('auth/login/', 'POST', {})).resolves.toEqual({})
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses the rotated cookie for logout immediately after login', async () => {
    document.cookie = 'csrftoken=before-login; path=/'
    const tokens: string[] = []
    fetchMock.mockImplementation(async (url, options) => {
      tokens.push((options?.headers as Record<string, string>)['X-CSRFToken'])
      if (url === '/api/v1/auth/login/') { document.cookie = 'csrftoken=after-login; path=/'; return response({ id: 1 }) }
      return response({}, 204)
    })
    await api('auth/login/', 'POST', {})
    await api('auth/logout/', 'POST')
    expect(tokens).toEqual(['before-login', 'after-login'])
  })
})
