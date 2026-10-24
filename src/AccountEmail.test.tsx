import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api, ApiError } from './api'
import { EmailVerificationPage } from './EmailVerificationPage'
import { PasswordResetPage } from './PasswordResetPage'
import { AuthPage } from './AuthPage'

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn() }))

function mount(element: React.ReactNode, path: string, pattern = path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path={pattern} element={element}/>
  </Routes></MemoryRouter></QueryClientProvider>)
  return client
}

beforeEach(() => { vi.mocked(api).mockReset(); vi.mocked(api).mockResolvedValue({}) })
afterEach(() => { cleanup(); localStorage.clear() })

describe('account email flows', () => {
  it('requests a password link and keeps a persistent generic confirmation', async () => {
    mount(<PasswordResetPage mode="request"/>, '/forgot-password')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }))
    expect(await screen.findByRole('heading', { name: 'Проверьте почту' })).toBeTruthy()
    expect(api).toHaveBeenCalledWith('auth/password-reset/', 'POST', { email: 'student@example.test' })
    expect(screen.getByRole('status').textContent).toContain('Если аккаунт с таким email существует')
    fireEvent.click(screen.getByRole('button', { name: 'Отправить письмо ещё раз' }))
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('rejects mismatched passwords before calling the server', async () => {
    mount(<PasswordResetPage mode="confirm"/>, '/reset-password/MQ/test-token', '/reset-password/:uid/:token')
    fireEvent.change(screen.getByLabelText('Новый пароль'), { target: { value: 'FirstStrongWord842!' } })
    fireEvent.change(screen.getByLabelText('Повторите пароль'), { target: { value: 'OtherStrongWord842!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Пароли не совпадают')
    expect(api).not.toHaveBeenCalled()
  })

  it('submits the reset token and untrimmed password, clears the old session and offers login', async () => {
    const client = mount(<PasswordResetPage mode="confirm"/>, '/reset-password/MQ/test-token', '/reset-password/:uid/:token')
    client.setQueryData(['me'], { id: 42 })
    client.setQueryData(['private-course'], { title: 'Cached data' })
    const password = '  ChangedStrongWord963!  '
    for (const label of ['Новый пароль', 'Повторите пароль']) fireEvent.change(screen.getByLabelText(label), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }))
    expect(await screen.findByRole('heading', { name: 'Пароль изменён' })).toBeTruthy()
    expect(api).toHaveBeenCalledWith('auth/password-reset/confirm/', 'POST', { uid: 'MQ', token: 'test-token', new_password: password })
    expect(client.getQueryData(['me'])).toBeNull()
    expect(client.getQueryData(['private-course'])).toBeUndefined()
    expect(screen.getByRole('link', { name: 'Войти' }).getAttribute('href')).toBe('/login')
  })

  it('shows an expired reset link with a way to request another email', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Ссылка недействительна или срок её действия истёк. Запросите новое письмо.', 400))
    mount(<PasswordResetPage mode="confirm"/>, '/reset-password/MQ/expired', '/reset-password/:uid/:token')
    for (const label of ['Новый пароль', 'Повторите пароль']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'ChangedStrongWord963!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Запросить новую ссылку' }).getAttribute('href')).toBe('/forgot-password')
    expect(screen.queryByText('Пароль изменён')).toBeNull()
  })

  it('verifies email only after confirmation and does not create an authenticated session', async () => {
    const client = mount(<EmailVerificationPage mode="verify"/>, '/verify-email/signed-token', '/verify-email/:token')
    expect(api).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить email' }))
    expect(await screen.findByRole('heading', { name: 'Email подтверждён' })).toBeTruthy()
    expect(api).toHaveBeenCalledWith('auth/verify-email/', 'POST', { token: 'signed-token' })
    expect(client.getQueryData(['me'])).toBeUndefined()
  })

  it('resends verification to the address from the registration screen', async () => {
    mount(<EmailVerificationPage mode="resend"/>, '/resend-verification?email=student%40example.test', '/resend-verification')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('student@example.test')
    fireEvent.click(screen.getByRole('button', { name: 'Отправить письмо подтверждения' }))
    expect(await screen.findByRole('heading', { name: 'Проверьте почту' })).toBeTruthy()
    expect(api).toHaveBeenCalledWith('auth/verify-email/resend/', 'POST', { email: 'student@example.test' })
  })

  it('offers another verification email when login rejects an unverified account', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Подтвердите email по ссылке из письма, чтобы войти в аккаунт.', 403, 'email_not_verified'))
    mount(<AuthPage mode="login"/>, '/login')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.test' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'StrongWord842!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Отправить письмо подтверждения' }).getAttribute('href')).toBe('/resend-verification'))
  })
})
