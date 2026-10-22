import { expect, test } from '@playwright/test'
import { workspaceSections } from '../src/workspace/types'
import { workshops } from '../src/workspace/workshops'

for (const width of [1440, 390]) {
  for (const [type, definition] of Object.entries(workshops).filter(([type]) => type !== 'lecture_workshop')) {
    test(`${type} generates, restores and completes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      const item = { id: 1, short_id: 'constructor', module: 1, module_title: 'Педагогика', course_id: 1,
        course_short_id: 'course', course_title: 'AI в образовании', title: definition.title,
        type: 'PRACTICE', status: 'PUBLISHED', position: 0 }
      const criteria = [{ title: 'Материал соответствует заданию', description: '', is_required: true }]
      const content = { title: 'Готовый учебный материал', sections: workspaceSections[definition.documentType]!.map(id => ({
        id, title: id, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Результат: ${id}` }] }] },
      })) }
      let started = false, generated = false, done = false, lastInput: Record<string, unknown> = {}
      const state = () => ({ version: { id: 1, practice_type: type, plugin_version: '1.0.0', version_number: 1,
        title: item.title, description: '', config: { instructions: [JSON.stringify({ type: 'doc', content: [{ type: 'paragraph',
          content: [{ type: 'text', text: 'Подготовьте материал и проверьте результат.' }] }] })], criteria } },
        submission: started ? { id: 99, document_id: generated ? 44 : null, status: done ? 'SUBMITTED' : 'IN_PROGRESS',
          submission_data: {}, criteria_snapshot: done ? [{ ...criteria[0], id: 1, position: 0, checked: true }] : [] } : null,
        current_version_id: 1, result: null, progress_percent: done ? 100 : 0, is_completed: done })
      const document = () => ({ id: 44, submission: 99, document_type: definition.documentType, schema_version: 1,
        revision: generated ? 2 : 1, parameters: {}, content: generated ? content : {} })
      await page.route(/^https:\/\//, route => route.abort())
      await page.route('**/api/v1/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1/', '')
        const json = (value: unknown, status = 200) => route.fulfill({ json: value, status })
        if (path === 'auth/me/') return json({ id: 5, email: 'student@example.test', first_name: 'Студент', last_name: '', role: 'STUDENT', learning_track: null })
        if (path === 'csrf/') return route.fulfill({ json: {}, headers: { 'set-cookie': 'csrftoken=test; Path=/' } })
        if (path === 'items/constructor/') return json(item)
        if (path === 'items/') return json({ count: 1, results: [item], next: null, previous: null })
        if (path === 'courses/course/progress/') return json({ percent: done ? 100 : 0, items: {} })
        if (path === 'items/constructor/practice/') {
          if (request.method() === 'POST') {
            expect(request.postDataJSON().submission_data).toMatchObject({ completed: true, checks: [true], document_id: 44, document_revision: 2 })
            done = true
          }
          return json(state())
        }
        if (path === 'items/constructor/practice/start/') { started = true; return json(state()) }
        if (path === 'items/constructor/practice/workspace/' || path === 'workspace/documents/44/') return json(document())
        if (path === 'workspace/source-lectures/') return json({ count: 1, results: [{ id: 8, title: 'Лекция о педагогике', updated_at: '' }], next: null, previous: null })
        if (path === 'workspace/documents/44/messages/') return json({ count: generated ? 2 : 0, results: generated ? [
          { id: 1, operation: 1, role: 'user', text: lastInput.prompt },
          { id: 2, operation: 1, role: 'assistant', text: 'Материал готов', content },
        ] : [], next: null, previous: null })
        if (path === 'workspace/documents/44/operations/') {
          lastInput = request.postDataJSON(); generated = true
          return json({ id: 1, document: 44, ...lastInput, status: 'SUCCEEDED', result: { content, revision: 2 } }, 202)
        }
        if (path === 'workspace/operations/1/') return json({ id: 1, document: 44, kind: 'chat', status: 'SUCCEEDED', result: { content, revision: 2 } })
        throw new Error(`Unexpected API ${request.method()} ${path}`)
      })
      await page.goto('/#/items/constructor')
      await page.getByRole('button', { name: 'Начать выполнение', exact: true }).click()
      await expect(page.getByRole('heading', { name: definition.welcome })).toBeVisible()
      if (definition.sourceLecture) await page.getByRole('combobox', { name: 'Созданная лекция' }).selectOption('8')
      if (definition.sessionTypes) await page.getByRole('button', { name: 'Деловая игра', exact: true }).click()
      await page.screenshot({ path: `test-results/${type}-empty-${width}.png`, fullPage: true })
      const prompt = page.getByRole('textbox', { name: 'Ваш запрос' })
      await prompt.fill(type === 'syllabus_workshop'
        ? 'Педагогика, специальность Учитель, 5 кредитов, 15 недель, результат: проектировать занятия.' : 'Педагогика для будущих преподавателей')
      await page.getByRole('button', { name: 'Отправить запрос', exact: true }).click()
      await expect(page.getByRole('heading', { name: content.title })).toBeVisible()
      if (definition.sourceLecture) expect(lastInput.source_lecture_id).toBe(8)
      if (definition.sessionTypes) expect(lastInput.prompt).toContain('Деловая игра')
      await page.reload()
      await page.getByRole('button', { name: 'Продолжить выполнение', exact: true }).click()
      await expect(page.getByRole('heading', { name: content.title })).toBeVisible()
      await page.screenshot({ path: `test-results/${type}-result-${width}.png`, fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(prompt).toBeInViewport()
      await page.getByRole('button', { name: 'Перейти к самопроверке', exact: true }).click()
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: 'Завершить работу', exact: true }).click()
      await expect(page.locator('.assignment-submitted')).toContainText('Практическая работа завершена')
      expect(done).toBe(true)
      expect(errors).toEqual([])
    })
  }
}
