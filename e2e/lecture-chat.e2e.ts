import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`lecture chat generates, restores and completes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const item = { id: 1, short_id: 'practice', module: 1, module_title: 'Основы AI', course_id: 1,
      course_short_id: 'course', course_title: 'AI в образовании', title: 'Создайте учебную лекцию',
      type: 'PRACTICE', status: 'PUBLISHED', position: 0 }
    const next = { ...item, id: 2, short_id: 'next', type: 'TEST', title: 'Проверка знаний', position: 1 }
    let started = false, done = false, generated = 0
    let lastPrompt = ''
    const messages: Record<string, unknown>[] = []
    const sectionIds = ['goal', 'learning_outcomes', 'outline', 'introduction', 'main_material', 'examples', 'key_concepts', 'conclusions', 'control_questions', 'self_study']
    const lecture = () => ({ title: generated > 1 ? 'Лекция с примерами' : 'Как применять AI в образовании',
      sections: sectionIds.map((id, index) => ({ id, title: `Раздел ${index + 1}`, content: { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Искусственный интеллект помогает преподавателю готовить материалы и адаптировать обучение к потребностям студентов.' }] },
      ] } })) })
    const state = () => ({ version: { id: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1,
      title: item.title, description: 'Подготовьте лекцию по своей дисциплине, используя AI.', config: {} },
      submission: started ? { id: 99, document_id: 44, status: done ? 'SUBMITTED' : 'IN_PROGRESS', submission_data: {} } : null,
      current_version_id: 1, result: null, progress_percent: done ? 100 : 0, is_completed: done })
    await page.route(/^https:\/\//, route => route.abort())
    await page.route('**/api/v1/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1/', '')
      const json = (value: unknown, status = 200) => route.fulfill({ json: value, status })
      if (path === 'auth/me/') return json({ id: 5, email: 'student@example.test', first_name: 'Студент', last_name: '', role: 'STUDENT', learning_track: null })
      if (path === 'csrf/') return route.fulfill({ json: {}, headers: { 'set-cookie': 'csrftoken=test; Path=/' } })
      if (path === 'items/practice/') return json(item)
      if (path === 'items/') return json({ count: 2, results: [item, next], next: null, previous: null })
      if (path === 'courses/course/progress/') return json({ percent: done ? 50 : 0, items: { practice: { progress_percent: done ? 100 : 0, is_completed: done } } })
      if (path === 'items/practice/practice/') {
        if (request.method() === 'POST') { expect(request.postDataJSON().submission_data).toEqual({ completed: true }); done = true }
        return json(state())
      }
      if (path === 'items/practice/practice/workspace/' || path === 'workspace/documents/44/') {
        if (request.method() === 'POST') { expect(request.postDataJSON()).toEqual({ language: 'ru' }); started = true }
        return json({ id: 44, submission: 99, document_type: 'lecture', schema_version: 1, revision: generated + 1, parameters: {}, content: generated ? lecture() : {} })
      }
      if (path === 'workspace/documents/44/messages/') return json({ count: messages.length, results: messages, next: null, previous: null })
      if (path === 'workspace/documents/44/operations/') {
        const data = request.postDataJSON(); lastPrompt = data.prompt; generated++
        messages.push({ id: generated * 2 - 1, operation: generated, role: 'user', text: lastPrompt },
          { id: generated * 2, operation: generated, role: 'assistant', text: 'Лекция создана', content: lecture() })
        return json({ id: generated, document: 44, ...data, status: 'SUCCEEDED', result: { content: lecture(), revision: generated + 1 } }, 202)
      }
      if (/^workspace\/operations\/\d+\/$/.test(path)) return json({ id: Number(path.split('/')[2]), document: 44, kind: 'generate', status: 'SUCCEEDED', result: { content: lecture(), revision: generated + 1 } })
      throw new Error(`Unexpected API ${request.method()} ${path}`)
    })
    await page.goto('/#/items/practice')
    const prompt = page.getByRole('textbox', { name: 'Ваш запрос' })
    await expect(prompt).toBeVisible()
    await expect(page.getByLabel('Название лекции')).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await page.screenshot({ path: `test-results/lecture-chat-empty-${width}.png`, fullPage: true })
    await prompt.fill('Подготовь лекцию о применении AI в образовании')
    await prompt.press('Enter')
    await expect(page.getByRole('heading', { name: 'Как применять AI в образовании' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Как применять AI в образовании' })).toBeVisible()
    expect(generated).toBe(1)
    await prompt.fill('Добавь практические примеры')
    await prompt.press('Enter')
    await expect(page.getByRole('heading', { name: 'Лекция с примерами' })).toBeVisible()
    expect(lastPrompt).toBe('Добавь практические примеры')
    await page.screenshot({ path: `test-results/lecture-chat-answer-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Сделано', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Выполнено', exact: true })).toBeDisabled()
    await expect(prompt).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Перейти к следующему материалу' })).toHaveAttribute('href', '#/items/next')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}
