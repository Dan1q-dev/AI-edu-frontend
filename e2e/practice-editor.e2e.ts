import { expect, test } from '@playwright/test'
import { workshops } from '../src/workspace/workshops'

test('practice editor keeps actions visible and protects unsaved edits on desktop and mobile', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const item = { id: 1, short_id: 'practice-1', module: 1, title: 'Практика: подготовка лекции', description: '', type: 'PRACTICE', position: 0, status: 'PUBLISHED', practice: 1 }
  let version = { id: 1, practice_definition: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1, title: item.title, description: '', status: 'PUBLISHED', published_at: null,
    config: { instructions: ['Подготовьте лекцию по выбранной теме.'], criteria: Array.from({ length: 12 }, (_, i) => ({ title: `Критерий ${i + 1}`, description: 'Проверьте результат по инструкции.', is_required: true })) } }
  const saved: string[] = []
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/', '')
    const json = (value: unknown) => route.fulfill({ json: value })
    if (path === 'auth/me/') return json({ id: 1, email: 'admin@example.test', first_name: 'Автор', last_name: '', role: 'ADMIN', learning_track: null })
    if (path === 'items/practice-1/') return json(item)
    if (path === 'modules/') return json({ results: [{ id: 1, short_id: 'module-1', title: 'Основы работы с ИИ', course: 1 }], next: null })
    if (path === 'practice-types/') return json(Object.entries(workshops).map(([type, definition]) => ({ type, version: '1.0.0', name: definition.title, description: definition.description, icon: 'sparkles', available: true })))
    if (path === 'items/practice-1/practice/draft/') {
      if (route.request().method() === 'PUT') {
        version = { ...version, ...route.request().postDataJSON() }; saved.push(version.title)
        return json(version)
      }
      return json({ draft: null, published: version, versions: [version] })
    }
    return json({ results: [], next: null })
  })
  await page.goto('/#/admin/curriculum/items/practice-1/edit')
  const title = page.getByRole('textbox', { name: 'Название', exact: true })
  await expect(title).toBeVisible()
  await expect(page.getByText('Все изменения сохранены', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
  const catalog = page.getByRole('region', { name: 'Выберите тип практической работы' })
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const before = await title.evaluate(element => element.getBoundingClientRect().top + window.scrollY)
    await page.getByRole('button', { name: 'Изменить практику' }).click()
    await expect(catalog).toBeVisible()
    await expect(catalog.getByRole('button', { name: /Конструктор практического занятия/ })).toBeVisible()
    expect(await title.evaluate(element => element.getBoundingClientRect().top + window.scrollY)).toBe(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/practice-selector-${width}.png` })
    await page.keyboard.press('Escape')
    await expect(catalog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Изменить практику' })).toBeFocused()
    await page.getByRole('button', { name: 'Изменить практику' }).click()
    await page.getByRole('heading', { level: 1 }).click()
    await expect(catalog).toHaveCount(0)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Изменить практику' }).click()
  await page.keyboard.press('Tab')
  await expect(catalog.getByRole('button', { name: /Конструктор практического занятия/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(catalog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: workshops.practical_workshop!.title, exact: true })).toBeVisible()
  await expect(title).toHaveValue(item.title)
  await page.getByRole('button', { name: 'Изменить практику' }).click()
  await catalog.getByRole('button', { name: /Мастерская лекций/ }).click()
  await expect(page.getByLabel('Описание критерия', { exact: true }).first()).toBeHidden()
  await page.locator('.practice-criterion-details summary').first().click()
  await expect(page.getByRole('textbox', { name: 'Описание критерия', exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Добавить критерий' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport()
  await expect(page.getByRole('link', { name: 'Основы работы с ИИ' })).toBeInViewport()
  await title.fill('Изменённая практика')
  await page.getByRole('link', { name: 'Основы работы с ИИ' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const expectCenteredDialog = async () => {
    const bounds = await dialog.boundingBox()
    const viewport = page.viewportSize()!
    expect(bounds).not.toBeNull()
    expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
    expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1)
  }
  await expectCenteredDialog()
  await expect(dialog.getByRole('button', { name: 'Остаться' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(title).toHaveValue('Изменённая практика')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Добавить критерий' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Обновить публикацию' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/practice-editor-mobile.png', fullPage: false })
  await page.getByRole('link', { name: 'Основы работы с ИИ' }).click()
  await expect(dialog).toBeVisible()
  await expectCenteredDialog()
  await dialog.getByRole('button', { name: 'Сохранить и выйти' }).click()
  await expect(page).toHaveURL(/#\/admin\/curriculum$/)
  expect(saved).toEqual(['Изменённая практика'])
  expect(errors).toEqual([])
})
