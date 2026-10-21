import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import App from './App'
import { api, apiAll, ApiError, type User } from './api'

vi.mock('./api', async importOriginal => ({
  ...await importOriginal<typeof import('./api')>(), api: vi.fn(), apiAll: vi.fn(),
}))
vi.mock('./AdminCurriculum', () => ({ AdminCurriculum: () => <p>Curriculum workspace</p> }))

const student: User = { id: 1, email: 'student@example.test', first_name: 'Ada', last_name: '', role: 'STUDENT', learning_track: null }
const admin: User = { ...student, id: 2, email: 'admin@example.test', role: 'ADMIN' }
const anonymous = () => new ApiError('Authentication credentials were not provided.', 403, 'not_authenticated')
const clients: QueryClient[] = []

function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output data-testid="location">{location.pathname}</output><button onClick={() => navigate(-1)}>Back</button></>
}

function mount(path = '/login', user?: User | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  if (user !== undefined) client.setQueryData(['me'], user)
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App/><Navigation/></MemoryRouter></QueryClientProvider>)
  return client
}

async function login(email = student.email, password = 'StrongPass321!') {
  await screen.findByRole('heading', { name: 'Продолжить обучение' })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
}

// Resolve real lazy modules before assertions; cold Vitest transforms are not UI latency.
beforeAll(async () => { await Promise.all([import('./AuthPage'), import('./MyLearningPage')]) })
beforeEach(() => {
  vi.mocked(api).mockReset()
  vi.mocked(apiAll).mockReset().mockResolvedValue([])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
  vi.mocked(api).mockImplementation(async path => {
    if (path === 'auth/me/') throw anonymous()
    if (path === 'me/learning/') return { resume_course: null, active_courses: [], completed_courses: [], available_courses: [] } as never
    if (path === 'auth/login/' || path === 'auth/register/') return student as never
    return undefined as never
  })
})
afterEach(async () => {
  cleanup()
  await Promise.all(clients.map(client => client.cancelQueries()))
  clients.splice(0).forEach(client => client.clear())
  vi.unstubAllGlobals()
  localStorage.clear(); sessionStorage.clear()
})

describe('authentication with mounted application', () => {
  it('renders the old login presentation without a readiness formula or demo access', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Продолжить обучение' })
    expect(screen.getByRole('heading', { name: 'AI Edu' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Режим входа' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Создать аккаунт' }).getAttribute('href')).toBe('/register')
    expect(document.querySelectorAll('form')).toHaveLength(1)
    expect(screen.queryByText(/Ω|Интегральная готовность|Формула адаптации/)).toBeNull()
    expect(screen.queryByText('Демонстрационный доступ')).toBeNull()
  })

  it('switches between login and registration from the reference-style mode selector', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Продолжить обучение' })
    fireEvent.click(screen.getByRole('link', { name: 'Создать аккаунт' }))
    await screen.findByRole('heading', { name: 'Новый участник' })
    expect(screen.getByTestId('location').textContent).toBe('/register')
    expect(screen.getByLabelText('Имя')).toBeTruthy()
    expect(screen.getByLabelText('Фамилия')).toBeTruthy()
  })

  it('updates the page on login and fetches learning for the new session', async () => {
    const client = mount()
    client.setQueryData(['courses'], [{ id: 99, title: 'Previous account course' }])
    await login()
    expect(await screen.findByLabelText('Меню пользователя')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/')
    expect(client.getQueryData(['me'])).toEqual(student)
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledWith('me/learning/'))
    expect(screen.queryByText('Previous account course')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('heading', { name: 'Продолжить обучение' })).toBeNull()
  })

  it('updates the page on logout and denies navigation back to private pages', async () => {
    const client = mount('/', student)
    client.setQueryData(['private-results'], ['old result'])
    await screen.findByLabelText('Меню пользователя')
    fireEvent.click(screen.getByText('Выйти'))
    expect(await screen.findByRole('heading', { name: 'Продолжить обучение' })).toBeTruthy()
    expect(screen.queryByLabelText('Меню пользователя')).toBeNull()
    expect(client.getQueryData(['me'])).toBeNull()
    expect(client.getQueryData(['private-results'])).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Продолжить обучение' })).toBeTruthy()
  })

  it('supports logout followed by login as a different role', async () => {
    mount('/', student)
    await screen.findByLabelText('Меню пользователя')
    fireEvent.click(screen.getByText('Выйти'))
    await screen.findByRole('heading', { name: 'Продолжить обучение' })
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'))
    // Change the login response after logout settles; auth/me must still represent an anonymous session.
    vi.mocked(api).mockImplementation(async path => {
      if (path === 'auth/me/') throw anonymous()
      return path === 'auth/login/' ? admin as never : undefined as never
    })
    await login(admin.email)
    expect(await screen.findByText('Curriculum workspace')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/admin/curriculum')
    expect(screen.getByText(admin.email)).toBeTruthy()
  })

  it('keeps logout errors visible and allows retry without losing the session', async () => {
    const client = mount('/', student)
    await screen.findByLabelText('Меню пользователя')
    const menu = document.querySelector('details.user-menu') as HTMLDetailsElement
    menu.open = true
    vi.mocked(api).mockRejectedValueOnce(new ApiError('Server unavailable', 503))
    fireEvent.click(screen.getByText('Выйти'))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Server unavailable')
    expect(menu.open).toBe(true)
    expect(client.getQueryData(['me'])).toEqual(student)
    fireEvent.click(screen.getByText('Выйти'))
    expect(await screen.findByRole('heading', { name: 'Продолжить обучение' })).toBeTruthy()
  })

  it('disables repeated logout while the request is pending', async () => {
    mount('/', student)
    await screen.findByLabelText('Меню пользователя')
    let complete!: () => void
    vi.mocked(api).mockImplementationOnce(() => new Promise(resolve => { complete = () => resolve(undefined as never) }))
    const button = screen.getByText('Выйти').closest('button')!
    fireEvent.click(button)
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === 'auth/logout/')).toHaveLength(1)
    await act(async () => complete())
    expect(await screen.findByRole('heading', { name: 'Продолжить обучение' })).toBeTruthy()
  })

  it('does not restore the old user when a pending profile request completes after logout', async () => {
    const client = mount('/', student)
    await screen.findByLabelText('Меню пользователя')
    let complete!: (user: User) => void
    vi.mocked(api).mockImplementationOnce(() => new Promise(resolve => { complete = user => resolve(user as never) }))
    let refetch!: Promise<void>
    act(() => { refetch = client.refetchQueries({ queryKey: ['me'] }) })
    fireEvent.click(screen.getByText('Выйти'))
    await screen.findByRole('heading', { name: 'Продолжить обучение' })
    await act(async () => { complete(student); await refetch })
    expect(client.getQueryData(['me'])).toBeNull()
    expect(screen.queryByLabelText('Меню пользователя')).toBeNull()
  })

  it('shows a server error instead of treating a failed profile request as logout', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Server unavailable', 503))
    mount('/')
    expect(await screen.findByText('Server unavailable')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Продолжить обучение' })).toBeNull()
  })

  it('allows existing accounts with a short password to attempt login', async () => {
    mount()
    await login(student.email, 'short')
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledWith('auth/login/', 'POST', { email: student.email, password: 'short' }))
    expect(await screen.findByLabelText('Меню пользователя')).toBeTruthy()
  })

  it('keeps failed login on the form and permits a corrected attempt', async () => {
    const client = mount()
    await screen.findByRole('heading', { name: 'Продолжить обучение' })
    vi.mocked(api).mockRejectedValueOnce(new ApiError('Неверный email или пароль', 400))
    await login()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Неверный email или пароль')
    expect(client.getQueryData(['me'])).toBeNull()
    await login()
    expect(await screen.findByLabelText('Меню пользователя')).toBeTruthy()
  })

  it('resets errors and passwords when switching to registration', async () => {
    mount()
    await screen.findByRole('heading', { name: 'Продолжить обучение' })
    vi.mocked(api).mockRejectedValueOnce(new ApiError('Неверный email или пароль', 400))
    await login()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('link', { name: 'Зарегистрироваться' }))
    await screen.findByRole('heading', { name: 'Новый участник' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByLabelText('Пароль') as HTMLInputElement).value).toBe('')
  })

  it('updates the mounted application after registration', async () => {
    vi.mocked(apiAll).mockImplementation(async path => path === 'tracks/'
      ? [{ id: 1, title: 'IT', short_id: 'it', description: '', cover: null, is_published: true, is_active: true, is_system: false }] as never
      : [] as never)
    mount('/register')
    await screen.findByRole('heading', { name: 'Новый участник' })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: student.email } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'StrongPass321!' } })
    fireEvent.click(await screen.findByRole('radio', { name: 'IT' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))
    expect(await screen.findByLabelText('Меню пользователя')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/')
  })
})
