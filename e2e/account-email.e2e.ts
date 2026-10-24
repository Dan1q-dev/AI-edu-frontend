import { expect, test, type Page } from '@playwright/test'

async function mockAccounts(page: Page) {
  const errors: string[] = []
  const calls: { path: string; data: Record<string, unknown> }[] = []
  let verified = false
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/^https:\/\//, route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/', '')
    const data = route.request().postDataJSON() ?? {}
    calls.push({ path, data })
    if (path === 'csrf/') return route.fulfill({ json: {}, headers: { 'set-cookie': 'csrftoken=test; Path=/' } })
    if (path === 'auth/me/') return route.fulfill({ status: 403, json: { error: { code: 'not_authenticated', detail: 'Sign in' } } })
    if (path === 'auth/register/') return route.fulfill({ status: 201, json: { email: data.email, verification_required: true } })
    if (path === 'auth/verify-email/') { verified = true; return route.fulfill({ json: { detail: 'Verified' } }) }
    if (path === 'auth/login/') return route.fulfill({ status: 403, json: { error: { code: verified ? 'error' : 'email_not_verified', detail: 'Подтвердите email по ссылке из письма, чтобы войти в аккаунт.' } } })
    if (path === 'auth/password-reset/confirm/') {
      if (data.token === 'expired') return route.fulfill({ status: 400, json: { error: { code: 'invalid', detail: 'Ссылка недействительна или срок её действия истёк. Запросите новое письмо.' } } })
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: { detail: 'Email sent' } })
  })
  return { calls, errors }
}

for (const width of [1440, 390]) {
  test(`registration waits for verification and can resend at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockAccounts(page)
    await page.goto('/#/register')
    await page.getByLabel('Email', { exact: true }).fill('student@example.test')
    await page.getByLabel('Пароль', { exact: true }).fill('StrongWord842!')
    await page.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Подтвердите email', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/#\/register$/)
    await page.screenshot({ path: `test-results/registration-email-${width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Отправить письмо ещё раз' }).click()
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('student@example.test')
    await page.getByRole('button', { name: 'Отправить письмо подтверждения' }).click()
    await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible()
    await page.goto('/#/verify-email/signed-token')
    await expect(page.getByRole('button', { name: 'Подтвердить email' })).toBeVisible()
    expect(state.calls.some(call => call.path === 'auth/verify-email/')).toBe(false)
    await page.getByRole('button', { name: 'Подтвердить email' }).click()
    await expect(page.getByRole('heading', { name: 'Email подтверждён' })).toBeVisible()
    await page.getByRole('link', { name: 'Войти', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Продолжить обучение' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(state.errors).toEqual([])
  })

  test(`password recovery handles success and expired links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const state = await mockAccounts(page)
    await page.goto('/#/login')
    await page.getByRole('link', { name: 'Забыли пароль?' }).click()
    await page.getByLabel('Email', { exact: true }).fill('student@example.test')
    await page.getByRole('button', { name: 'Отправить ссылку', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible()
    await page.goto('/#/reset-password/MQ/expired')
    for (const name of ['Новый пароль', 'Повторите пароль']) await page.getByLabel(name, { exact: true }).fill('ChangedWord963!')
    await page.getByRole('button', { name: 'Сохранить новый пароль' }).click()
    await expect(page.getByRole('alert')).toContainText('Ссылка недействительна')
    await expect(page.getByRole('link', { name: 'Запросить новую ссылку' })).toBeVisible()
    await page.goto('/#/reset-password/MQ/valid-token')
    for (const name of ['Новый пароль', 'Повторите пароль']) await page.getByLabel(name, { exact: true }).fill('ChangedWord963!')
    await page.screenshot({ path: `test-results/password-reset-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Сохранить новый пароль' }).click()
    await expect(page.getByRole('heading', { name: 'Пароль изменён' })).toBeVisible()
    expect(state.calls.find(call => call.path === 'auth/password-reset/confirm/' && call.data.token === 'valid-token')?.data)
      .toEqual({ uid: 'MQ', token: 'valid-token', new_password: 'ChangedWord963!' })
    expect(state.errors).toEqual([])
  })
}
