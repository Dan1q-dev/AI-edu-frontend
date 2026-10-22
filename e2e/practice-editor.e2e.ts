import { expect, test } from '@playwright/test'

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
    if (path === 'practice-types/') return json([{ type: 'lecture_workshop', version: '1.0.0', name: 'Виртуальная мастерская генерации лекции', description: 'Подготовка лекции с помощью ИИ', icon: 'sparkles', available: true }])
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
  await dialog.getByRole('button', { name: 'Сохранить и выйти' }).click()
  await expect(page).toHaveURL(/#\/admin\/curriculum$/)
  expect(saved).toEqual(['Изменённая практика'])
  expect(errors).toEqual([])
})
