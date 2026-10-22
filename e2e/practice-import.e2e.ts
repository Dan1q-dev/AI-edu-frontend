import { expect, test, type Page } from '@playwright/test'

async function openPractice(page: Page, fail = false) {
  const errors: string[] = [], saved: any[] = []
  page.on('pageerror', error => errors.push(error.message))
  const item = { id: 1, short_id: 'practice-import', module: 1, title: 'Практика: анализ учебного материала', description: '', type: 'PRACTICE', position: 0, status: 'PUBLISHED', practice: 1 }
  const criteria = [{ title: 'Проверьте достоверность примеров', description: 'Сохранённый критерий', is_required: true }]
  const source_files = [{ media: 8, name: 'Исходный материал.pdf', size: 42, url: '/api/v1/media/8/download/' }]
  let version = { id: 1, practice_definition: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1, title: item.title, description: '', status: 'PUBLISHED', published_at: null,
    config: { instructions: [JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Исходная инструкция' }] }] })], criteria, source_files } }
  let created = false
  const blocks = [
    { type: 'TEXT', position: 0, content: JSON.stringify({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Задание из документа' }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Сравните источники', marks: [{ type: 'bold' }] }] }] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ключевой пример' }] }] }] }] },
      { type: 'blockMath', attrs: { latex: 'x^2' } },
    ] }), media: null, config: {} },
    { type: 'IMAGE', position: 1, content: 'Схема задания', media: 7, media_url: '/api/v1/media/7/', config: {} },
  ]
  const job = (status = 'SUCCEEDED') => ({ id: 'job-1', name: 'Задание.docx', size: 42, status, stage: 'ready', source_url: '', error: status === 'FAILED' ? 'Не удалось обработать документ. Можно повторить импорт.' : '', result: status === 'SUCCEEDED' ? { blocks, warnings: ['ocr_review'] } : null })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/', '')
    const json = (value: unknown, status = 200) => route.fulfill({ status, json: value })
    if (path === 'auth/me/') return json({ id: 1, email: 'admin@example.test', first_name: 'Автор', last_name: '', role: 'ADMIN', learning_track: null })
    if (path === 'items/practice-import/') return json(item)
    if (path === 'modules/') return json({ results: [{ id: 1, short_id: 'module-1', title: 'Основы работы с ИИ', course: 1 }], next: null })
    if (path === 'practice-types/') return json([{ type: 'lecture_workshop', version: '1.0.0', name: 'Виртуальная мастерская генерации лекции', description: 'Подготовка лекции с помощью ИИ', icon: 'sparkles', available: true }])
    if (path === 'items/practice-import/practice/imports/') {
      if (route.request().method() === 'POST') { created = true; return json(job('PENDING'), 202) }
      return json({ jobs: created ? [job(fail ? 'FAILED' : 'SUCCEEDED')] : [] })
    }
    if (path === 'items/practice-import/practice/imports/job-1/') return json(job(fail ? 'FAILED' : 'SUCCEEDED'))
    if (path === 'items/practice-import/practice/draft/') {
      if (route.request().method() === 'PUT') { const payload = route.request().postDataJSON(); saved.push(payload); version = { ...version, ...payload }; return json(version) }
      return json({ draft: null, published: version, versions: [version] })
    }
    if (path === 'media/7/') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160"><rect width="640" height="160" fill="#eef2fc"/><text x="200" y="85" fill="#4058af" font-size="24">Task diagram</text></svg>' })
    return json({ results: [], next: null })
  })
  await page.goto('/#/admin/curriculum/items/practice-import/edit')
  await expect(page.getByRole('textbox', { name: 'Инструкция к заданию' })).toBeVisible()
  return { errors, saved, criteria, source_files }
}

async function upload(page: Page) {
  await page.getByRole('button', { name: 'Импорт из файла', exact: true }).click()
  await page.getByLabel('Файл инструкции', { exact: true }).setInputFiles({ name: 'Задание.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('Parser is covered by real DOCX backend tests') })
  await page.getByRole('button', { name: 'Распознать файл', exact: true }).click()
}

test('reviews, appends and undoes imported instructions, preserving criteria and source files on save', async ({ page }) => {
  const state = await openPractice(page)
  await page.screenshot({ path: 'test-results/practice-import-button.png' })
  await upload(page)
  const dialog = page.getByRole('dialog', { name: 'Импорт инструкции из файла' })
  await expect(dialog.locator('table')).toContainText('Ключевой пример')
  const apply = dialog.getByRole('button', { name: 'Перенести в инструкцию', exact: true })
  await expect(apply).toBeDisabled()
  const editor = page.getByRole('textbox', { name: 'Инструкция к заданию' })
  await expect(editor).not.toContainText('Задание из документа')
  await dialog.getByRole('button', { name: 'Добавить в конец', exact: true }).click()
  await page.screenshot({ path: 'test-results/practice-import-review.png' })
  await apply.click()
  await expect(dialog).toHaveCount(0)
  await expect(editor).toContainText('Исходная инструкция')
  await expect(editor.locator('h2')).toContainText('Задание из документа')
  await expect(editor.locator('strong')).toContainText('Сравните источники')
  await expect(editor.locator('table')).toContainText('Ключевой пример')
  await expect(editor.getByRole('img', { name: 'Схема задания' })).toBeVisible()
  await editor.click()
  await page.keyboard.press('Control+z')
  await expect(editor).not.toContainText('Задание из документа')
  await expect(editor).toContainText('Исходная инструкция')
  await page.keyboard.press('Control+Shift+z')
  await expect(editor).toContainText('Задание из документа')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible()
  expect(state.saved[0].config.criteria).toEqual(state.criteria)
  expect(state.saved[0].config.source_files).toEqual(state.source_files)
  expect(state.saved[0].config.instructions.join('')).toContain('practiceImage')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Инструкция к заданию' }).getByRole('img', { name: 'Схема задания' })).toBeVisible()
  expect(state.errors).toEqual([])
})

test('resumes import on mobile and replaces only the instruction after explicit selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await openPractice(page)
  await upload(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Импорт из файла', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('table')).toContainText('Ключевой пример')
  await expect(dialog.getByRole('button', { name: 'Перенести в инструкцию' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Заменить содержимое', exact: true }).click()
  await page.screenshot({ path: 'test-results/practice-import-mobile.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await dialog.getByRole('button', { name: 'Перенести в инструкцию' }).click()
  const editor = page.getByRole('textbox', { name: 'Инструкция к заданию' })
  await expect(editor).not.toContainText('Исходная инструкция')
  await expect(editor).toContainText('Задание из документа')
  await expect(page.getByRole('textbox', { name: 'Название', exact: true })).toHaveValue('Практика: анализ учебного материала')
  await expect(page.getByRole('textbox', { name: 'Критерий 1', exact: true })).toHaveValue(state.criteria[0].title)
  expect(state.saved).toHaveLength(0)
  expect(state.errors).toEqual([])
})

test('failed import keeps current instructions and never enables transfer', async ({ page }) => {
  await openPractice(page, true)
  await upload(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('Не удалось обработать документ')
  await expect(dialog.getByRole('button', { name: 'Перенести в инструкцию' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).last().click()
  await expect(page.getByRole('textbox', { name: 'Инструкция к заданию' })).toHaveText('Исходная инструкция')
})
