import { expect, test, type Page } from '@playwright/test'

async function openMaterial(page: Page, id: string, workspace = false, failSubmit = false) {
  const errors: string[] = [], posts: unknown[] = []
  let attempt: Record<string, unknown> | null = null
  page.on('pageerror', error => errors.push(error.message))
  const common = { module: 1, module_title: 'Основы', module_position: 0, course_id: 1, course_short_id: 'course', course_title: 'Учебный курс', status: 'PUBLISHED', description: '' }
  const items = [
    { ...common, id: 1, short_id: 'intro', type: 'LECTURE', title: 'Короткое введение', position: 0, lesson_short_id: 'intro-content' },
    { ...common, id: 2, short_id: 'lecture', type: 'LECTURE', title: 'Подробная лекция с длинным названием для проверки навигации', position: 1, lesson_short_id: 'lecture-content' },
    { ...common, id: 3, short_id: 'practice', type: 'PRACTICE', title: 'Практическая работа', position: 2 },
    { ...common, id: 4, short_id: 'test', type: 'TEST', title: 'Итоговый тест', position: 3 },
    { ...common, id: 5, short_id: 'locked', type: 'LECTURE', title: 'Продолжение курса', position: 0, module: 2, module_title: 'Продолжение', module_position: 1, is_locked: true, lesson_short_id: 'locked-content' },
  ]
  const questions = [
    { id: 1, position: 0, points: 1, text: 'Какой ответ верный?', options: [{ id: 11, text: 'Правильный вариант', position: 0 }, { id: 12, text: 'Неверный вариант', position: 1 }] },
    { id: 2, position: 1, points: 1, text: 'Выберите число четыре', options: [{ id: 21, text: 'Четыре', position: 0 }, { id: 22, text: 'Пять', position: 1 }] },
  ]
  const criteria = Array.from({ length: 10 }, (_, index) => ({ title: `Критерий ${index + 1}`, description: 'Проверьте выполнение работы и отметьте результат.', is_required: true }))
  await page.route(/^https:\/\//, route => route.abort())
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1/', '')
    const json = (value: unknown, status = 200) => route.fulfill({ json: value, status })
    if (path === 'auth/me/') return json({ id: 1, email: 'student@example.test', first_name: 'Студент', last_name: '', role: 'STUDENT', learning_track: { id: 1, title: 'Обучение', short_id: 'track' } })
    if (path === 'csrf/') return route.fulfill({ json: {}, headers: { 'set-cookie': 'csrftoken=test; Path=/' } })
    if (path === 'items/') return json({ results: items.map(item => item.short_id === 'locked' ? { ...item, is_locked: !attempt } : item), next: null, previous: null, count: items.length })
    if (/^items\/[^/]+\/$/.test(path)) return json(items.find(item => path === `items/${item.short_id}/`))
    if (path === 'courses/course/progress/') return json({ percent: attempt ? 100 : 20, items: { intro: { progress_percent: 100, is_completed: true }, lecture: { progress_percent: 35, is_completed: false } } })
    if (/\/progress\/$/.test(path)) return json({ progress_percent: 100 })
    if (/\/blocks\/$/.test(path)) return json([{ id: 1, type: 'TEXT', position: 0, media: null, config: {}, content: path.includes('lecture-content') ? Array.from({ length: 35 }, (_, index) => `## Раздел ${index + 1}\n\nТекст учебного материала. Прочитайте объяснение и рассмотрите примеры.`).join('\n\n') : 'Короткий материал.' }])
    if (/\/attachments\/$/.test(path)) return json([])
    if (path === 'items/test/test/') return json({ id: 1, version: 1, title: 'Итоговый тест', description: 'Проверьте знания по модулю.', passing_percent: 50, max_attempts: 3, questions })
    if (path === 'items/test/attempts/') {
      if (request.method() === 'POST') {
        posts.push(request.postDataJSON())
        if (failSubmit) return json({ detail: 'Отправка временно недоступна' }, 503)
        const answers = request.postDataJSON().answers as { question: number; option: number }[]
        const snapshot = questions.map(question => {
          const selected = answers.find(answer => answer.question === question.id)!.option
          return { question: question.text, question_id: question.id, selected: question.options.find(option => option.id === selected)!.text, correct: question.options[0]!.text, is_correct: selected === question.options[0]!.id, earned_points: selected === question.options[0]!.id ? 1 : 0, points: 1, selected_option_id: selected, correct_option_id: question.options[0]!.id, options: question.options }
        })
        attempt = { id: 1, test: 1, test_version: 1, passed: true, percent: 50, earned_points: 1, total_points: 2, completed_at: '2026-10-15T00:00:00Z', answers, snapshot }
        return json(attempt, 201)
      }
      return json({ count: attempt ? 1 : 0, results: attempt ? [attempt] : [], next: null, previous: null })
    }
    if (path === 'items/practice/practice/') return json({ version: { id: 1, practice_type: workspace ? 'lecture_workshop' : 'checklist_practice', plugin_version: '1.0.0', title: 'Практическая работа', description: 'Выполните задания по порядку.', version_number: 1, config: { criteria } }, submission: null, current_version_id: 1, result: null, progress_percent: 0, is_completed: false })
    throw new Error(`Unexpected API request: ${path}`)
  })
  await page.goto(`/#/items/${id}`)
  await expect(page.locator('.learning-main h1,.learning-main h2').first()).toBeVisible()
  return { errors, posts }
}

for (const width of [1440, 1100, 390]) {
  test(`lecture has one next action and no fixed navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 })
    const state = await openMaterial(page, 'lecture')
    await expect(page.locator('.lesson-navigation')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Предыдущий элемент/ })).toHaveCount(0)
    const next = page.getByRole('link', { name: 'Перейти к следующему материалу' })
    await expect(next).toHaveCount(1)
    await next.scrollIntoViewIfNeeded()
    await expect(next).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await next.click()
    await expect(page).toHaveURL(/#\/items\/practice$/)
    await expect(page.locator('.learning-tutor')).toHaveCount(0)
    expect(state.errors).toEqual([])
  })
}

test('desktop contents close, reopen and collapse individual or all modules', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  const state = await openMaterial(page, 'intro')
  const outline = page.getByRole('complementary', { name: 'Содержание курса' })
  await expect(outline.getByRole('img', { name: 'Завершён', exact: true })).toHaveCount(1)
  await expect(outline.getByText('Завершён', { exact: true })).toHaveCount(0)
  await expect(outline.getByRole('button', { name: 'Модуль 1 Основы' })).toHaveAttribute('aria-expanded', 'true')
  await outline.getByRole('button', { name: 'Модуль 1 Основы' }).click()
  await expect(outline.getByRole('link', { name: /Короткое введение/ })).toBeHidden()
  await outline.getByRole('button', { name: 'Раскрыть все модули' }).click()
  await expect(outline.getByText('Продолжение курса', { exact: true })).toBeVisible()
  await expect(outline.getByRole('link', { name: /Продолжение курса/ })).toHaveCount(0)
  await outline.getByRole('button', { name: 'Свернуть все модули' }).click()
  await expect(outline.getByText('Продолжение курса', { exact: true })).toBeHidden()
  await outline.getByRole('button', { name: 'Закрыть оглавление' }).click()
  await expect(outline).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Содержание', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Содержание', exact: true }).click()
  await expect(outline).toBeVisible()
  await outline.getByRole('button', { name: 'Модуль 1 Основы' }).click()
  await page.screenshot({ path: 'test-results/course-contents-desktop.png', fullPage: true })
  expect(state.errors).toEqual([])
})

test('practice workspace retains contents and has no tutor', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 950 })
  const state = await openMaterial(page, 'practice', true)
  await expect(page.locator('.is-document-workspace')).toBeVisible()
  const outline = page.getByRole('complementary', { name: 'Содержание курса' })
  await expect(outline).toBeVisible()
  await expect(page.locator('.learning-tutor')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Открыть тьютора' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/practice-with-contents.png', fullPage: true })
  await outline.getByRole('link', { name: /Короткое введение/ }).click()
  await expect(page).toHaveURL(/#\/items\/intro$/)
  expect(state.errors).toEqual([])
})

test('closing desktop contents persists across next-item navigation and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openMaterial(page, 'intro')
  await page.getByRole('button', { name: 'Закрыть оглавление' }).click()
  await page.getByRole('link', { name: 'Перейти к следующему материалу' }).click()
  await expect(page).toHaveURL(/#\/items\/lecture$/)
  await expect(page.locator('.lesson-article')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Содержание курса' })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.lesson-article')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Содержание курса' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Содержание', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Содержание курса' })).toBeVisible()
})

test('mobile contents use a keyboard-accessible drawer and close after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await openMaterial(page, 'intro')
  await page.getByRole('button', { name: 'Содержание', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Содержание курса' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Закрыть оглавление' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(drawer.getByRole('button', { name: 'Модуль 2 Продолжение' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await page.getByRole('button', { name: 'Содержание', exact: true }).click()
  await drawer.getByRole('link', { name: /Практическая работа/ }).click()
  await expect(page).toHaveURL(/#\/items\/practice$/)
  await expect(drawer).toHaveCount(0)
  expect(state.errors).toEqual([])
})

for (const width of [1440, 390]) {
  test(`test has introduction, confirmation and durable answer review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 })
    const state = await openMaterial(page, 'test')
    await expect(page.locator('.learning-tutor')).toHaveCount(0)
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Перейти к следующему материалу' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Начать тестирование', exact: true }).click()
    await expect(page).toHaveURL(/view=assessment/)
    await expect(page.locator('.is-assessment')).toBeVisible()
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Отправить ответы', exact: true })).toBeDisabled()
    await page.getByRole('radio', { name: 'Правильный вариант', exact: true }).check()
    await page.getByRole('radio', { name: 'Пять', exact: true }).check()
    await page.screenshot({ path: `test-results/assessment-questions-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Отправить ответы', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Отправить ответы?' })
    await expect(dialog).toBeVisible()
    expect(state.posts).toHaveLength(0)
    await page.screenshot({ path: `test-results/assessment-confirm-${width}.png` })
    await dialog.getByRole('button', { name: 'Вернуться к вопросам' }).click()
    await expect(page.getByRole('radio', { name: 'Пять', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Отправить ответы', exact: true }).click()
    await dialog.getByRole('button', { name: 'Завершить тестирование' }).click()
    await expect(page).toHaveURL(/view=results/)
    await expect(page.getByRole('heading', { name: 'Ваш результат: 50%' })).toBeVisible()
    await expect(page.locator('.assessment-feedback.is-correct')).toHaveCount(1)
    await expect(page.locator('.assessment-feedback.is-incorrect')).toHaveCount(1)
    await expect(page.locator('.assessment-review-option.is-correct').filter({ hasText: 'Четыре' })).toBeVisible()
    expect(state.posts).toHaveLength(1)
    await page.screenshot({ path: `test-results/assessment-results-${width}.png`, fullPage: true })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Ваш результат: 50%' })).toBeVisible()
    await page.getByRole('link', { name: 'Перейти к следующему материалу' }).click()
    await expect(page).toHaveURL(/#\/items\/locked$/)
    expect(state.errors).toEqual([])
  })
}

test('test drafts survive leaving and reload without consuming an attempt', async ({ page }) => {
  const state = await openMaterial(page, 'test')
  await page.getByRole('button', { name: 'Начать тестирование', exact: true }).click()
  await page.getByRole('radio', { name: 'Правильный вариант', exact: true }).check()
  await page.getByRole('button', { name: 'Сохранить и выйти' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Продолжить тестирование' }).click()
  await expect(page.getByRole('radio', { name: 'Правильный вариант', exact: true })).toBeChecked()
  expect(state.posts).toHaveLength(0)
})

test('submission errors keep the selected answers and permit returning to the questions', async ({ page }) => {
  const state = await openMaterial(page, 'test', false, true)
  await page.getByRole('button', { name: 'Начать тестирование', exact: true }).click()
  await page.getByRole('radio', { name: 'Правильный вариант', exact: true }).check()
  await page.getByRole('radio', { name: 'Пять', exact: true }).check()
  await page.getByRole('button', { name: 'Отправить ответы', exact: true }).click()
  await page.getByRole('button', { name: 'Завершить тестирование' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Отправка временно недоступна')
  await page.getByRole('button', { name: 'Вернуться к вопросам' }).click()
  await expect(page.getByRole('radio', { name: 'Пять', exact: true })).toBeChecked()
  expect(state.posts).toHaveLength(1)
  expect(state.errors).toEqual([])
})
