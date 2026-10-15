import { expect, test, type Page } from '@playwright/test'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64')
const initial = () => ({ title: 'Основы физики', description: 'Учебная лекция', attachments: [], blocks: [
  { type: 'TEXT', position: 0, content: '## Введение\n\nПервый абзац', media: null, config: {} },
  { type: 'TEXT', position: 1, content: 'Второй абзац', media: null, config: {} },
  { type: 'IMAGE', position: 2, content: 'Схема', media: 7, media_url: '/api/v1/media/7/', config: { alt: 'Схема движения' } },
] })

async function openEditor(page: Page, settings: { slowSave?: boolean; failSave?: boolean; slowUpload?: boolean } = {}) {
  let draft = initial(), published = false
  const saves: typeof draft[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/^https:\/\//, route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1/', '')
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value })
    if (path === 'auth/me/') return json({ id: 1, email: 'admin@example.test', first_name: 'Автор', last_name: '', role: 'ADMIN', learning_track: null })
    if (path === 'csrf/') return route.fulfill({ json: {}, headers: { 'set-cookie': 'csrftoken=test; Path=/' } })
    if (path === 'lessons/lecture-1/') return json({ id: 1, short_id: 'lecture-1', title: draft.title, status: published ? 'PUBLISHED' : 'DRAFT', module: 1 })
    if (path === 'lessons/lecture-1/draft/') {
      if (request.method() === 'PUT') {
        if (settings.slowSave) await new Promise(resolve => setTimeout(resolve, 1200))
        if (settings.failSave) return json({ detail: 'Сохранение недоступно' }, 503)
        draft = request.postDataJSON(); saves.push(draft)
      }
      if (request.method() === 'POST') published = true
      return json(draft)
    }
    if (path === 'media/' && request.method() === 'POST') {
      if (settings.slowUpload) await new Promise(resolve => setTimeout(resolve, 1800))
      return json({ id: 8, url: '/api/v1/media/8/' })
    }
    if (/^media\/\d+\/$/.test(path)) return route.fulfill({ contentType: 'image/png', body: png })
    throw new Error(`Unexpected API request: ${path}`)
  })
  await page.goto('/#/admin/curriculum/lessons/lecture-1/edit')
  await expect(page.getByRole('textbox', { name: 'Текст лекции' })).toBeVisible()
  return { saves, errors, get published() { return published } }
}

test('continuous selection, global undo and history retained through preview', async ({ page }) => {
  const result = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'Текст лекции' })
  await expect(page.locator('.tiptap')).toHaveCount(1)
  await editor.click(); await page.keyboard.press('Control+a')
  const selection = await page.evaluate(() => window.getSelection()?.toString())
  expect(selection).toContain('Первый абзац'); expect(selection).toContain('Второй абзац')
  await page.keyboard.press('Backspace')
  await expect(editor).not.toContainText('Первый абзац')
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(editor).toContainText('Первый абзац'); await expect(editor.locator('img')).toHaveCount(1)
  await page.getByRole('button', { name: 'Предпросмотр', exact: true }).click()
  await expect(page.locator('.lesson-preview')).toContainText('Второй абзац')
  await page.getByRole('button', { name: 'Редактор', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeEnabled()
  expect(result.errors).toEqual([])
})

test('slash search in Russian, table editing and new content render in preview', async ({ page }) => {
  const result = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'Текст лекции' })
  await editor.click(); await page.keyboard.press('Control+End'); await page.keyboard.press('Enter')
  await page.keyboard.type('/таб')
  await expect(page.getByRole('menuitem', { name: 'Таблица', exact: true })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(editor.locator('table tr')).toHaveCount(3)
  await page.getByRole('button', { name: '+ Строка', exact: true }).click()
  await expect(editor.locator('table tr')).toHaveCount(4)
  await page.getByRole('button', { name: 'Добавить содержимое', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Важно', exact: true }).click()
  await expect(editor.locator('aside')).toContainText('Важно')
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
  await page.keyboard.type('Текст после врезки')
  await expect(editor.locator('aside')).not.toContainText('Текст после врезки')
  await expect(editor).toContainText('Текст после врезки')
  await page.getByRole('button', { name: 'Добавить содержимое', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Формула LaTeX', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('E=mc^2')
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect(editor.locator('.katex')).toHaveCount(1)
  await page.getByRole('button', { name: 'Добавить содержимое', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Видео', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('https://evil.test/embed/123')
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await page.getByRole('dialog').getByRole('textbox').fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByRole('button', { name: 'Применить', exact: true }).click()
  await page.getByRole('button', { name: 'Предпросмотр', exact: true }).click()
  const preview = page.locator('.lesson-preview')
  await expect(preview.locator('table tr')).toHaveCount(4)
  await expect(preview.locator('aside[data-tone=important]')).toBeVisible()
  await expect(preview.locator('.katex')).toHaveCount(1)
  await expect(preview.locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  await page.screenshot({ path: 'test-results/lecture-preview.png', fullPage: true })
  expect(result.errors).toEqual([])
})

test('publishing flushes newer changes after a slow autosave', async ({ page }) => {
  const result = await openEditor(page, { slowSave: true })
  const title = page.getByRole('textbox', { name: 'Название лекции', exact: true })
  await title.fill('Первая правка')
  await page.waitForRequest(request => request.method() === 'PUT')
  await title.fill('Последняя правка')
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Лекция опубликована' })).toBeVisible({ timeout: 10000 })
  expect(result.saves.at(-1)?.title).toBe('Последняя правка')
  expect(result.published).toBe(true)
  expect(result.errors).toEqual([])
})

test('failed autosave retains edits and blocks publication', async ({ page }) => {
  const result = await openEditor(page, { failSave: true })
  await page.getByRole('textbox', { name: 'Название лекции', exact: true }).fill('Не терять эту правку')
  await expect(page.getByRole('alert')).toContainText('Сохранение недоступно')
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Сохранение недоступно')
  expect(result.published).toBe(false)
  await expect(page.getByRole('textbox', { name: 'Название лекции', exact: true })).toHaveValue('Не терять эту правку')
})

test('image upload stays attached to its placeholder while the author keeps typing', async ({ page }) => {
  const result = await openEditor(page, { slowUpload: true })
  await page.getByRole('button', { name: 'Добавить содержимое', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Изображение', exact: true }).click()
  await (await chooser).setFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.lecture-image-loading')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Опубликовать', exact: true })).toBeDisabled()
  const editor = page.getByRole('textbox', { name: 'Текст лекции' })
  await editor.click(); await page.keyboard.press('Control+Home'); await page.keyboard.type('Дополнение ')
  await expect(editor.locator('img')).toHaveCount(2)
  await expect.poll(() => result.saves.length).toBeGreaterThan(0)
  const saved = result.saves.at(-1)!
  expect(saved.blocks.filter(block => block.type === 'IMAGE').map(block => block.media)).toEqual([7, 8])
  expect(saved.blocks[0]!.content).toContain('Дополнение')
  expect(result.errors).toEqual([])
})

test('mobile editor keeps insertion controls within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const result = await openEditor(page)
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Таблица', exact: true })).toBeVisible()
  const bounds = await page.getByRole('menu').boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/lecture-mobile.png', fullPage: true })
  expect(result.errors).toEqual([])
})

test('block handle exposes moving, deletion and global undo', async ({ page }) => {
  const result = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'Текст лекции' })
  await editor.getByRole('heading', { name: 'Введение' }).hover()
  await page.locator('.lecture-grip').hover()
  await page.locator('.lecture-block-actions').getByRole('button', { name: 'Ниже', exact: true }).click()
  await expect(editor.locator(':scope > *').first()).toHaveText('Первый абзац')
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(editor.locator(':scope > *').first()).toHaveText('Введение')
  await editor.getByRole('heading', { name: 'Введение' }).hover()
  await page.locator('.lecture-grip').hover()
  await page.locator('.lecture-block-actions').getByRole('button', { name: 'Удалить блок', exact: true }).click()
  await expect(editor.getByRole('heading', { name: 'Введение' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Отменить', exact: true }).click()
  await expect(editor.getByRole('heading', { name: 'Введение' })).toBeVisible()
  expect(result.errors).toEqual([])
})

test('dragging a block uses the handle without losing text or media', async ({ page }) => {
  const result = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'Текст лекции' })
  await editor.getByRole('heading', { name: 'Введение' }).hover()
  const target = editor.locator('p').filter({ hasText: 'Второй абзац' })
  const bounds = await target.boundingBox()
  await page.locator('.lecture-grip').dragTo(target, { targetPosition: { x: 30, y: bounds!.height - 1 } })
  await expect(editor.locator(':scope > *').first()).not.toHaveText('Введение')
  await expect(editor).toContainText('Введение')
  await expect(editor).toContainText('Первый абзац')
  await expect(editor.locator('img')).toHaveCount(1)
  expect(result.errors).toEqual([])
})
