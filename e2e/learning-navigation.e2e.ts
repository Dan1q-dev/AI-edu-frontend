import { expect, test, type Page } from '@playwright/test'

async function openMaterial(page: Page, id: string, workspace = false) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const common = { module: 1, module_title: 'Основы', module_position: 0, course_id: 1, course_short_id: 'course', course_title: 'Учебный курс', status: 'PUBLISHED', description: '' }
  const items = [
    { ...common, id: 1, short_id: 'intro', type: 'LECTURE', title: 'Короткое введение', position: 0, lesson_short_id: 'intro-content' },
    { ...common, id: 2, short_id: 'lecture', type: 'LECTURE', title: 'Подробная лекция с длинным названием для проверки навигации', position: 1, lesson_short_id: 'lecture-content' },
    { ...common, id: 3, short_id: 'practice', type: 'PRACTICE', title: 'Практическая работа с очень длинным названием', position: 2 },
    { ...common, id: 4, short_id: 'test', type: 'TEST', title: 'Итоговый тест', position: 3 },
    { ...common, id: 5, short_id: 'locked', type: 'LECTURE', title: 'Следующий модуль', position: 4, module: 2, is_locked: true },
  ]
  const criteria = Array.from({ length: 20 }, (_, index) => ({ title: `Критерий ${index + 1}`, description: 'Проверьте выполнение работы и отметьте результат.', is_required: true }))
  const question = { points: 1, options: [{ id: 1, text: 'Ответ А', position: 0 }, { id: 2, text: 'Ответ Б', position: 1 }] }
  await page.route(/^https:\/\//, route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/v1/', '')
    const json = (value: unknown) => route.fulfill({ json: value })
    if (path === 'auth/me/') return json({ id: 1, email: 'student@example.test', first_name: 'Студент', last_name: '', role: 'STUDENT', learning_track: { id: 1, title: 'Обучение', short_id: 'track' } })
    if (path === 'csrf/') return route.fulfill({ json: {}, headers: { 'set-cookie': 'csrftoken=test; Path=/' } })
    if (path === 'items/') return json({ results: items, next: null, previous: null, count: items.length })
    if (/^items\/[^/]+\/$/.test(path)) return json(items.find(item => path === `items/${item.short_id}/`))
    if (path === 'courses/course/progress/') return json({ percent: 0, items: {} })
    if (/\/progress\/$/.test(path)) return json({ progress_percent: 100 })
    if (/\/blocks\/$/.test(path)) return json([{ id: 1, type: 'TEXT', position: 0, media: null, config: {}, content: path.includes('intro-content') ? 'Короткий материал.' : Array.from({ length: 45 }, (_, index) => `## Раздел ${index + 1}\n\nТекст учебного материала. Прочитайте объяснение и рассмотрите примеры.`).join('\n\n') }])
    if (/\/attachments\/$/.test(path)) return json([])
    if (path === 'items/test/test/') return json({ title: 'Итоговый тест', description: '', passing_percent: 70, max_attempts: null, questions: Array.from({ length: 18 }, (_, index) => ({ ...question, id: index + 1, position: index, text: `Вопрос ${index + 1}` })) })
    if (path === 'items/test/attempts/') return json({ count: 0, results: [], next: null, previous: null })
    if (path === 'items/practice/practice/') return json({
      version: { id: 1, practice_type: workspace ? 'lecture_workshop' : 'checklist_practice', plugin_version: '1.0.0', title: 'Практическая работа', description: 'Выполните задания по порядку.', version_number: 1, config: { criteria } },
      submission: null, current_version_id: 1, result: null, progress_percent: 0, is_completed: false,
    })
    throw new Error(`Unexpected API request: ${path}`)
  })
  await page.goto(`/#/items/${id}`)
  await expect(page.getByRole('navigation', { name: 'Навигация по материалам' })).toBeVisible()
  await expect(page.locator('.learning-main h1,.learning-main h2').first()).toBeVisible()
  return errors
}

async function expectDocked(page: Page) {
  await expect.poll(async () => {
    const dock = await page.locator('.lesson-navigation').boundingBox()
    return Math.abs(dock!.y + dock!.height - page.viewportSize()!.height)
  }).toBeLessThan(2)
  const dock = await page.locator('.lesson-navigation').boundingBox(), center = await page.locator('.learning-center').boundingBox()
  expect(dock!.x).toBeCloseTo(center!.x, 0)
  expect(dock!.width).toBeCloseTo(center!.width, 0)
  for (const link of await page.getByRole('navigation', { name: 'Навигация по материалам' }).getByRole('link').all()) {
    const bounds = await link.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(dock!.x)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(dock!.x + dock!.width + 1)
  }
  return dock!
}

for (const width of [1440, 1100, 390]) {
  for (const id of ['lecture', 'practice', 'test']) {
    test(`${id} navigation stays at the viewport bottom at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 })
      const errors = await openMaterial(page, id)
      const dock = await expectDocked(page)
      const navigation = page.getByRole('navigation', { name: 'Навигация по материалам' })
      await expect(navigation.getByRole('link', { name: /Предыдущий элемент/ })).toBeVisible()
      if (id !== 'test') await expect(navigation.getByRole('link', { name: /Следующий элемент/ })).toBeVisible()
      else await expect(navigation).toContainText('Сначала завершите текущий модуль')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
      expect((await expectDocked(page)).y).toBeCloseTo(dock.y, 0)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expectDocked(page)
      const main = await page.locator('.learning-main').boundingBox()
      expect(main!.y + main!.height).toBeLessThanOrEqual(dock.y + 1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (id === 'lecture' && width !== 1100) await page.screenshot({ path: `test-results/navigation-${width}.png` })
      expect(errors).toEqual([])
    })
  }
}

test('short content, responsive resizing and navigation links keep the correct positions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 850 })
  const errors = await openMaterial(page, 'intro')
  await expectDocked(page)
  const navigation = page.getByRole('navigation', { name: 'Навигация по материалам' })
  await expect(navigation.getByRole('link', { name: /Предыдущий элемент/ })).toHaveCount(0)
  await expect(navigation).toContainText('1 из 5')
  await page.setViewportSize({ width: 390, height: 750 })
  await expectDocked(page)
  await navigation.getByRole('link', { name: /Следующий элемент/ }).click()
  await expect(page).toHaveURL(/#\/items\/lecture$/)
  await expect(navigation).toContainText('2 из 5')
  await expectDocked(page)
  expect(errors).toEqual([])
})

test('the expanded practice workspace also keeps navigation aligned to its center', async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 850 })
  const errors = await openMaterial(page, 'practice', true)
  await expect(page.locator('.learning-layout')).toHaveClass(/is-document-workspace/)
  await expectDocked(page)
  await page.setViewportSize({ width: 390, height: 750 })
  await expectDocked(page)
  expect(errors).toEqual([])
})
