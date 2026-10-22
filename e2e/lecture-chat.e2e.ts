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
    let started = false, done = false, generated = 0, turns = 0
    let lastPrompt = ''
    const messages: Record<string, unknown>[] = []
    const criteria = [
      { title: 'Лекция соответствует заданию', description: 'Проверьте тему и аудиторию', is_required: true },
      { title: 'Содержание проверено', description: 'Исправьте неточности', is_required: true },
    ]
    const instruction = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Подготовьте полную лекцию и проверьте её перед завершением работы.' }] }] })
    const sectionIds = ['goal', 'learning_outcomes', 'outline', 'introduction', 'main_material', 'examples', 'key_concepts', 'conclusions', 'control_questions', 'self_study']
    const lecture = () => ({ title: generated > 1 ? 'Лекция с примерами' : 'Как применять AI в образовании',
      sections: sectionIds.map((id, index) => ({ id, title: `Раздел ${index + 1}`, content: { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Искусственный интеллект помогает преподавателю готовить материалы и адаптировать обучение к потребностям студентов.' }] },
      ] } })) })
    const state = () => ({ version: { id: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1,
      title: item.title, description: 'Подготовьте лекцию по своей дисциплине, используя AI.', config: { instructions: [instruction], criteria } },
      submission: started ? { id: 99, document_id: generated ? 44 : null, status: done ? 'SUBMITTED' : 'IN_PROGRESS',
        submission_data: done ? { completed: true, checks: [true, true] } : {},
        criteria_snapshot: done ? criteria.map((row, i) => ({ ...row, id: i + 1, position: i, checked: true })) : [] } : null,
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
        if (request.method() === 'POST') { expect(request.postDataJSON().submission_data).toMatchObject({ completed: true, checks: [true, true], document_id: 44 }); done = true }
        return json(state())
      }
      if (path === 'items/practice/practice/start/') { started = true; return json(state()) }
      if (path === 'items/practice/practice/workspace/' || path === 'workspace/documents/44/') {
        if (request.method() === 'POST') { expect(request.postDataJSON()).toEqual({ language: 'ru' }); started = true }
        return json({ id: 44, submission: 99, document_type: 'lecture', schema_version: 1, revision: turns + 1, parameters: {}, content: generated ? lecture() : {} })
      }
      if (path === 'workspace/documents/44/messages/') return json({ count: messages.length, results: messages, next: null, previous: null })
      if (path === 'workspace/artifacts/1/download/') return route.fulfill({
        body: 'DOCX download fixture', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        headers: { 'content-disposition': 'attachment; filename="lecture.docx"' },
      })
      if (path === 'workspace/documents/44/operations/') {
        const data = request.postDataJSON(); lastPrompt = data.prompt; turns++
        expect(data.kind).toBe('chat')
        messages.push({ id: turns * 2 - 1, operation: turns, role: 'user', text: lastPrompt })
        let result: Record<string, unknown>
        if (turns <= 2) {
          const text = turns === 1 ? 'Для кого подготовить лекцию и на сколько минут?' : 'На каком языке подготовить лекцию?'
          const choices = turns === 1 ? ['Студенты · 45 минут', 'Преподаватели · 60 минут'] : ['Русский', 'Қазақша', 'English']
          result = { action: 'clarify', choices }
          messages.push({ id: turns * 2, operation: turns, role: 'assistant', text, choices })
        } else if (lastPrompt === 'Подготовить Word-файл') {
          const artifact = { id: 1, name: 'Лекция.docx', size: 40000, revision: turns + 1, url: '/api/v1/workspace/artifacts/1/download/' }
          result = { action: 'export', artifact }
          messages.push({ id: turns * 2, operation: turns, role: 'assistant', text: 'Файл Word готов.', artifact })
        } else {
          generated++
          const choices = ['Изменить раздел', 'Добавить примеры', 'Добавить вопросы', 'Сократить лекцию', 'Подготовить Word-файл']
          result = { action: generated === 1 ? 'generate' : 'edit', content: lecture(), choices }
          messages.push({ id: turns * 2, operation: turns, role: 'assistant', text: 'Лекция создана', content: lecture(), choices })
        }
        return json({ id: turns, document: 44, ...data, status: 'SUCCEEDED', result: { ...result, revision: turns + 1 } }, 202)
      }
      if (/^workspace\/operations\/\d+\/$/.test(path)) return json({ id: Number(path.split('/')[2]), document: 44, kind: 'chat', status: 'SUCCEEDED', result: { revision: turns + 1 } })
      throw new Error(`Unexpected API ${request.method()} ${path}`)
    })
    await page.goto('/#/items/practice')
    const prompt = page.getByRole('textbox', { name: 'Ваш запрос' })
    await expect(page.getByRole('heading', { name: 'Инструкция к заданию', exact: true })).toBeVisible()
    await expect(prompt).toHaveCount(0)
    expect(turns).toBe(0)
    await page.screenshot({ path: `test-results/lecture-task-${width}.png`, fullPage: true })
    const nextAction = page.getByRole('link', { name: 'Перейти к следующему материалу' })
    const taskButton = await nextAction.boundingBox()
    await page.getByRole('button', { name: 'Начать выполнение', exact: true }).click()
    await expect(page.locator('.is-document-workspace')).toBeVisible()
    await expect(nextAction).toBeInViewport({ ratio: 1 })
    const workspaceButton = await nextAction.boundingBox()
    expect(workspaceButton!.height).toBe(taskButton!.height)
    expect(workspaceButton!.width).toBe(taskButton!.width)
    expect(workspaceButton!.y).toBeCloseTo(taskButton!.y, 0)
    await expect(prompt).toBeVisible()
    const compactInput = await prompt.boundingBox()
    expect(compactInput!.height).toBeLessThanOrEqual(36)
    const composer = page.locator('.lecture-chat-composer')
    expect((await composer.boundingBox())!.height).toBeLessThanOrEqual(56)
    await prompt.fill(Array.from({ length: 24 }, (_, index) => `Строка ${index + 1} с подробностями лекции`).join('\n'))
    await expect.poll(() => prompt.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    const expandedInput = await prompt.boundingBox()
    expect(expandedInput!.height).toBeGreaterThan(compactInput!.height)
    expect(expandedInput!.height).toBeLessThanOrEqual(160)
    expect(await prompt.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
    await prompt.fill('Короткий запрос')
    await expect.poll(async () => (await prompt.boundingBox())!.height).toBeLessThanOrEqual(36)
    await prompt.fill('')
    if (width > 1250) {
      const handle = page.getByRole('separator', { name: 'Изменить ширину панели тьютора' })
      const tutor = page.locator('#learning-tutor-panel')
      const before = (await tutor.boundingBox())!.width
      const border = (await handle.boundingBox())!
      await page.mouse.move(border.x + 3, border.y + 160)
      await page.mouse.down()
      await page.mouse.move(border.x - 100, border.y + 160, { steps: 10 })
      await page.mouse.up()
      await expect.poll(async () => (await tutor.boundingBox())!.width).toBeGreaterThan(before + 80)
      await handle.focus()
      await page.keyboard.press('ArrowRight')
      const remembered = (await tutor.boundingBox())!.width
      await page.reload()
      await page.getByRole('button', { name: 'Продолжить выполнение', exact: true }).click()
      await expect.poll(async () => (await tutor.boundingBox())!.width).toBeCloseTo(remembered, 0)
      await handle.dblclick()
      await expect.poll(async () => (await tutor.boundingBox())!.width).toBeCloseTo(300, 0)
    }
    await expect(page.getByLabel('Название лекции')).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await page.screenshot({ path: `test-results/lecture-chat-empty-${width}.png`, fullPage: true })
    await prompt.fill('Подготовь лекцию о применении AI в образовании')
    await page.getByRole('button', { name: 'Отправить запрос', exact: true }).click()
    await page.getByRole('button', { name: 'Студенты · 45 минут', exact: true }).click()
    await page.getByRole('button', { name: 'Русский', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Как применять AI в образовании' })).toBeVisible()
    await page.reload()
    await expect(prompt).toHaveCount(0)
    await page.getByRole('button', { name: 'Продолжить выполнение', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Как применять AI в образовании' })).toBeVisible()
    expect(generated).toBe(1)
    await prompt.fill('Добавь практические примеры')
    await page.getByRole('button', { name: 'Отправить запрос', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Лекция с примерами' })).toBeVisible()
    expect(lastPrompt).toBe('Добавь практические примеры')
    const scroll = page.locator('.lecture-chat-scroll')
    const footer = page.locator('.lecture-chat-footer')
    expect((await scroll.boundingBox())!.height).toBeGreaterThan(900 * .6)
    await expect.poll(() => scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    await scroll.evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect.poll(async () => {
      const answer = await page.locator('.lecture-chat-message.assistant').last().boundingBox()
      const panel = await footer.boundingBox()
      return answer!.y + answer!.height - panel!.y
    }).toBeLessThanOrEqual(1)
    const footerBefore = await footer.boundingBox()
    await scroll.evaluate(element => { element.scrollTop = 0 })
    const footerAfter = await footer.boundingBox()
    expect(footerAfter!.y).toBeCloseTo(footerBefore!.y, 0)
    const inputBox = await prompt.boundingBox()
    expect(inputBox!.y).toBeGreaterThanOrEqual(0)
    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(900)
    const heading = await page.locator('.lecture-chat-heading').boundingBox()
    const navigation = await page.locator('.learning-header').boundingBox()
    expect(heading!.height).toBeLessThanOrEqual(70)
    expect(heading!.y).toBeGreaterThanOrEqual(navigation!.y + navigation!.height)
    await scroll.evaluate(element => { element.scrollTop = element.scrollHeight })
    await page.screenshot({ path: `test-results/lecture-chat-answer-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Подготовить Word-файл', exact: true }).click()
    const attachment = page.getByRole('link', { name: /Лекция.docx/ })
    await expect(attachment).toBeVisible()
    const downloadPromise = page.waitForEvent('download')
    await attachment.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.docx$/)
    expect(generated).toBe(2)
    await page.screenshot({ path: `test-results/lecture-chat-docx-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Перейти к самопроверке', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Завершить работу', exact: true })).toBeDisabled()
    expect(done).toBe(false)
    const checks = page.getByRole('checkbox')
    await expect(checks).toHaveCount(2)
    await checks.nth(0).check()
    await page.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
    await expect(prompt).toBeVisible()
    await page.getByRole('button', { name: 'К заданию', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Инструкция к заданию', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Продолжить выполнение', exact: true }).click()
    await page.getByRole('button', { name: 'Перейти к самопроверке', exact: true }).click()
    await expect(checks.nth(0)).toBeChecked()
    await checks.nth(1).check()
    await page.screenshot({ path: `test-results/lecture-review-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Завершить работу', exact: true }).click()
    await expect(page.locator('.assignment-submitted')).toContainText('Практическая работа завершена')
    expect(done).toBe(true)
    await expect(prompt).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Перейти к следующему материалу' })).toHaveAttribute('href', '#/items/next')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}
