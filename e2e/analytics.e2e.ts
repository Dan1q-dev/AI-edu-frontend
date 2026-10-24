import { expect, test } from '@playwright/test'
import { analyticsFixture } from './fixtures/analytics'

for (const width of [1440, 390]) {
  test(`analytics filters, modules and CSV work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/^https:\/\//, route => route.abort())
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/auth/me/')) return route.fulfill({ json: { id: 1, email: 'admin@example.test', first_name: 'Администратор', last_name: '', role: 'ADMIN', learning_track: null } })
      if (path.endsWith('/admin/analytics/')) return route.fulfill({ json: analyticsFixture })
      return route.fulfill({ json: {} })
    })
    await page.goto('/#/admin/analytics')
    await expect(page.getByRole('heading', { name: 'Аналитика', exact: true })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Статистика курсов' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Аналитика', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/analytics-${width}.png`, fullPage: true })
    await page.getByRole('combobox', { name: 'Период активности' }).click()
    const request = page.waitForRequest(request => request.url().includes('/admin/analytics/?period=7d'))
    await page.getByRole('option', { name: 'Последние 7 дней' }).click()
    await request
    await expect(page).toHaveURL(/period=7d/)
    await page.getByRole('button', { name: 'Модули (2)' }).click()
    await page.getByRole('searchbox', { name: 'Поиск по названию' }).fill('Основы')
    const table = page.getByRole('table', { name: 'Статистика модулей' })
    await expect(table.getByRole('link', { name: 'Основы искусственного интеллекта' })).toBeVisible()
    await expect(table.getByRole('link', { name: 'Практическое применение' })).toHaveCount(0)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Экспорт CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('analytics-modules-7d')
    await download.saveAs(`test-results/analytics-${width}.csv`)
    await page.getByText('Как считаются показатели').click()
    await expect(page.getByText('Активность — сохранённый прогресс', { exact: false })).toBeVisible()
    expect(errors).toEqual([])
  })
}
