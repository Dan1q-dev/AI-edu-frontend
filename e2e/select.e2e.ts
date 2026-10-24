import { expect, test, type Page } from '@playwright/test'

async function openUsers(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/^https:\/\//, route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/', '')
    if (path === 'auth/me/') return route.fulfill({ json: { id: 1, email: 'admin@example.test', first_name: 'Администратор', last_name: '', role: 'ADMIN', learning_track: null } })
    if (path === 'admin/users/') return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
    if (path === 'tracks/') return route.fulfill({ json: { count: 1, next: null, previous: null, results: [{ id: 1, short_id: 'it', title: 'Информационные технологии', is_published: true, is_active: true }] } })
    if (path === 'courses/') return route.fulfill({ json: { count: 40, next: null, previous: null, results: Array.from({ length: 40 }, (_, index) => ({ id: index + 1, title: `Курс ${index + 1}: Применение искусственного интеллекта в образовании`, learning_track: 1, is_published: true })) } })
    return route.fulfill({ json: {} })
  })
  await page.goto('/#/admin/users')
  await expect(page.getByRole('heading', { name: 'Пользователи', exact: true })).toBeVisible()
  return errors
}

for (const width of [1440, 390]) {
  test(`shared filters stay compact and usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors = await openUsers(page)
    if (width === 390) await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
    const status = page.getByRole('combobox', { name: 'Статус', exact: true })
    await status.click()
    const list = page.getByRole('listbox')
    await expect(list).toBeVisible()
    const triggerBounds = (await status.boundingBox())!
    const listBounds = (await list.boundingBox())!
    expect(listBounds.width).toBeCloseTo(triggerBounds.width, 0)
    expect(listBounds.height).toBeLessThan(160)
    await page.screenshot({ path: `test-results/shared-select-${width}.png`, fullPage: true })
    await page.getByRole('option', { name: 'Неактивен', exact: true }).click()
    await expect(status).toHaveText('Неактивен')
    await expect(page).toHaveURL(/status=inactive/)
    await expect(list).toHaveCount(0)
    await expect(status).toBeFocused()
    await status.press('Enter')
    await status.press('Home')
    await status.press('ArrowDown')
    await status.press('Enter')
    await expect(status).toHaveText('Активен')
    await expect(page).toHaveURL(/status=active/)

    const course = page.getByRole('combobox', { name: 'Курс', exact: true })
    await course.click()
    await expect(page.getByRole('option')).toHaveCount(41)
    const bounds = (await list.boundingBox())!
    expect(bounds.height).toBeLessThanOrEqual(288)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    await course.press('End')
    await expect(page.getByRole('option').last()).toBeInViewport()
    await course.press('Enter')
    await expect(course).toContainText('Курс 40:')
    await expect(page.locator('select:visible')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('Escape closes the dropdown before the form, and language uses the same listbox', async ({ page }) => {
  const errors = await openUsers(page)
  await page.getByRole('button', { name: 'Добавить пользователя', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const track = dialog.getByRole('combobox', { name: 'Траектория обучения', exact: true })
  await track.click()
  await expect(dialog.getByRole('listbox')).toBeVisible()
  await track.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await track.click()
  await page.getByRole('option', { name: 'Информационные технологии', exact: true }).click()
  await expect(track).toHaveText('Информационные технологии')
  await track.press('Escape')
  await expect(dialog).toHaveCount(0)

  const language = page.getByRole('combobox', { name: 'Язык интерфейса' })
  await language.click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('combobox', { name: 'Interface language' })).toHaveText('English')
  expect(errors).toEqual([])
})
