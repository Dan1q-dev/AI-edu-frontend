import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api, apiAll, ApiError, type LearningItem } from '../api'
import { I18nProvider } from '../i18n'
import type { PracticeState } from '../practice/types'
import { LectureWorkshop } from './LectureWorkshop'
import { sectionIds, type Lecture, type WorkspaceDocument, type WorkspaceMessage, type WorkspaceOperation } from './types'
import { workspaceSections } from './types'
import { workshops } from './workshops'
import { getPracticePlugin } from '../practice/registry'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn(), apiAll: vi.fn() }))
const mockedApi = vi.mocked(api), mockedAll = vi.mocked(apiAll)
const lecture: Lecture = { title: 'Лекция о педагогике', sections: sectionIds.map(id => ({ id, title: id,
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Содержание ${id}` }] }] } })) }
const document: WorkspaceDocument = { id: 44, submission: 99, document_type: 'lecture', schema_version: 1, revision: 1,
  created_at: '', updated_at: '', content: lecture, parameters: { discipline: 'Педагогика', topic: 'Обучение', course: '2', audience: 'Преподаватели', duration_minutes: 45,
    difficulty: 'intermediate', learning_outcomes: ['Объяснить методы'], language: 'ru' } }
const item = { id: 3, short_id: 'workshop-1', type: 'PRACTICE' } as LearningItem
const state: PracticeState = { version: { id: 7, practice_definition: 9, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1,
  title: 'Мастерская', description: 'Legacy practice description', status: 'PUBLISHED', published_at: null, config: {} }, current_version_id: 7,
  submission: { id: 99, document_id: 44, status: 'IN_PROGRESS', practice_version: 7, submission_data: {}, criteria_snapshot: [], started_at: '', submitted_at: null, completed_at: null },
  result: null, progress_percent: 0, is_completed: false }
let operation: WorkspaceOperation, messages: WorkspaceMessage[], clients: QueryClient[]
const submit = vi.fn(), review = vi.fn()
function mount(overrides: Partial<PracticeState> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity } } }); clients.push(client)
  const view = render(<I18nProvider><QueryClientProvider client={client}><LectureWorkshop state={{ ...state, ...overrides }} item={item} ownerId={5} busy={false} onStart={vi.fn()} onSubmit={submit} onReview={review}/></QueryClientProvider></I18nProvider>)
  return { ...view, client }
}
async function ready() {
  await waitFor(() => expect((screen.getByRole('button', { name: /Перейти к самопроверке|Go to self-check|Өзін-өзі тексеруге өту/ }) as HTMLButtonElement).disabled).toBe(false))
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); clients = []; messages = []
  operation = { id: 71, document: 44, kind: 'generate', request_id: '', status: 'PENDING', base_revision: 1, result: {}, error_code: '' } as WorkspaceOperation
  mockedAll.mockImplementation(async () => structuredClone(messages) as never)
  mockedApi.mockImplementation(async (path, method = 'GET', data) => {
    if (path.endsWith('/workspace/')) return document as never
    if (path === 'workspace/documents/44/') return document as never
    if (path === 'workspace/documents/44/operations/' && method === 'POST') {
      operation = { ...operation, ...data as Partial<WorkspaceOperation> }
      messages = [{ id: 1, operation: 71, role: 'user', text: (data as { prompt: string }).prompt, created_at: '' }]
      return structuredClone(operation) as never
    }
    if (path === 'workspace/operations/71/') return structuredClone(operation) as never
    throw new Error(`Unexpected API ${method} ${path}`)
  })
})
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); vi.restoreAllMocks() })

describe('lecture chat', () => {
  it('restores the lecture from server submission without localStorage or POST requests', async () => {
    mount(); await screen.findByText(lecture.title); await ready()
    expect(screen.queryByText('Legacy practice description')).toBeNull()
    expect(screen.queryByLabelText('Название лекции')).toBeNull()
    expect(screen.queryByLabelText('Дисциплина')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
  })
  it('creates the chat and sends a prompt without a separate start or parameters form', async () => {
    mount({ submission: null })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Лекция о педагогике для начинающих' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить запрос' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/operations/', 'POST', expect.objectContaining({ prompt: 'Лекция о педагогике для начинающих', kind: 'chat', revision: 1 })))
    expect(mockedApi).toHaveBeenCalledWith('items/workshop-1/practice/workspace/', 'POST', { language: 'ru' })
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(''))
  })
  it('renders full assistant lectures in the message history', async () => {
    messages = [{ id: 1, operation: 71, role: 'assistant', text: 'Лекция создана', content: lecture, created_at: '' }]
    operation.status = 'SUCCEEDED'
    mount(); await screen.findByText(lecture.title); await ready()
    expect(screen.getAllByText(lecture.title)).toHaveLength(1)
    expect(screen.getByText('Содержание main_material')).toBeTruthy()
  })
  it('polls a queued generation and disables completion until it finishes', async () => {
    const { client } = mount(); await ready()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Добавь примеры' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false })
    await screen.findByText('Запрос в очереди. Ожидаем начала генерации…')
    expect((screen.getByRole('button', { name: 'Перейти к самопроверке' }) as HTMLButtonElement).disabled).toBe(true)
    operation = { ...operation, status: 'RUNNING' }
    await act(() => client.invalidateQueries({ queryKey: ['workspace-operation'] }))
    await screen.findByText('Помощник готовит ответ…')
    expect((screen.getByRole('button', { name: 'Перейти к самопроверке' }) as HTMLButtonElement).disabled).toBe(true)
    operation = { ...operation, status: 'SUCCEEDED', result: { content: lecture, revision: 2 } }
    await act(() => client.invalidateQueries({ queryKey: ['workspace-operation'] }))
    await ready()
    expect(mockedApi.mock.calls.filter(([path, method]) => path.endsWith('/operations/') && method === 'POST')).toHaveLength(1)
  })
  it('preserves the same request UUID and payload after an uncertain response', async () => {
    const original = mockedApi.getMockImplementation()!
    let failed = false
    mockedApi.mockImplementation((path, method, data) => {
      if (path.endsWith('/operations/') && !failed) { failed = true; return Promise.reject(new Error('offline')) }
      return original(path, method, data)
    })
    mount(); await ready()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Добавь примеры' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить запрос' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить отправку' }))
    await waitFor(() => expect(mockedApi.mock.calls.filter(([path]) => path.endsWith('/operations/'))).toHaveLength(2))
    const calls = mockedApi.mock.calls.filter(([path]) => path.endsWith('/operations/'))
    expect(calls[0]![2]).toEqual(calls[1]![2])
  })
  it('opens self-check without submitting and keeps completed chats read-only', async () => {
    mount(); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к самопроверке' }))
    expect(review).toHaveBeenCalledWith({ completed: true, document_id: 44, document_revision: 1 }, expect.objectContaining({ title: lecture.title }))
    expect(submit).not.toHaveBeenCalled()
    cleanup()
    mount({ submission: { ...state.submission!, status: 'SUBMITTED' }, is_completed: true })
    await screen.findByText(lecture.title); await ready()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect((screen.getByRole('button', { name: 'Перейти к самопроверке' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('can retry a failed AI generation with the previous prompt and a new request UUID', async () => {
    messages = [{ id: 1, operation: 71, role: 'user', text: 'Создай лекцию', created_at: '' }]
    operation = { ...operation, status: 'FAILED', request_id: 'old-request', error_code: 'ai_timeout' }
    mount(); await ready()
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить отправку' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/operations/', 'POST', expect.objectContaining({ prompt: 'Создай лекцию', kind: 'chat' })))
    const payload = mockedApi.mock.calls.find(([path]) => path.endsWith('/operations/'))![2] as { request_id: string }
    expect(payload.request_id).not.toBe('old-request')
  })
  it('hides the conversation when access is denied', async () => {
    mockedApi.mockRejectedValue(new ApiError('Forbidden', 403))
    mount(); await screen.findByRole('alert')
    expect(screen.queryByText(lecture.title)).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('sends an inline answer choice through the same chat endpoint', async () => {
    operation.status = 'SUCCEEDED'
    messages = [{ id: 1, operation: 71, role: 'assistant', text: 'Для какой аудитории?',
      choices: ['Студенты · 45 минут', 'Преподаватели · 60 минут'], created_at: '' }]
    mount(); await ready()
    expect(screen.getByRole('group', { name: 'Варианты ответа' })).toBeTruthy()
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/operations/71/'))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Студенты · 45 минут' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Студенты · 45 минут' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/operations/', 'POST',
      expect.objectContaining({ kind: 'chat', prompt: 'Студенты · 45 минут' })))
  })
  it('shows private Word attachments in assistant messages without a permanent export button', async () => {
    operation.status = 'SUCCEEDED'
    messages = [{ id: 1, operation: 71, role: 'assistant', text: 'Файл готов', artifact: {
      id: 3, name: 'Лекция.docx', size: 40000, url: '/api/v1/workspace/artifacts/3/download/', revision: 2 }, created_at: '' }]
    mount(); await ready()
    const link = screen.getByRole('link', { name: /Лекция.docx/ })
    expect(link.getAttribute('href')).toBe('/api/v1/workspace/artifacts/3/download/')
    expect(link.getAttribute('download')).toBe('Лекция.docx')
    expect(screen.queryByRole('button', { name: /Word|DOCX/ })).toBeNull()
  })
  it('does not render historical choices or untrusted attachment URLs', async () => {
    operation.status = 'SUCCEEDED'
    messages = [
      { id: 1, operation: 70, role: 'assistant', text: 'Старый вопрос', choices: ['Старый вариант'], created_at: '' },
      { id: 2, operation: 71, role: 'assistant', text: 'Файл готов', artifact: {
        id: 3, name: 'Bad.docx', size: 1, url: 'https://untrusted.test/file.docx', revision: 2 }, created_at: '' },
    ]
    mount(); await ready()
    expect(screen.queryByRole('button', { name: 'Старый вариант' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Bad.docx/ })).toBeNull()
  })
  it.each([['en', 'Go to self-check', 'en'], ['kz', 'Өзін-өзі тексеруге өту', 'kk']])('uses %s labels and the corresponding generation language', async (locale, done, language) => {
    localStorage.setItem('ai-edu-locale', locale!)
    mount({ submission: null })
    expect(screen.getByRole('button', { name: done })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Lecture' } })
    fireEvent.submit(screen.getByRole('textbox').closest('form')!)
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('items/workshop-1/practice/workspace/', 'POST', { language }))
  })
})

describe('shared teaching constructors', () => {
  for (const [type, definition] of Object.entries(workshops).filter(([type]) => type !== 'lecture_workshop')) {
    it(`restores and reviews ${type} with its own content contract`, async () => {
      const content = { title: definition.title, sections: workspaceSections[definition.documentType]!.map(id => ({
        id, title: id, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Result ${id}` }] }] },
      })) }
      const original = mockedApi.getMockImplementation()!
      mockedApi.mockImplementation((path, method, data) => path === 'workspace/documents/44/'
        ? Promise.resolve({ ...document, document_type: definition.documentType, content } as never) : original(path, method, data))
      expect(getPracticePlugin(type, '1.0.0')?.layout).toBe('workspace')
      mount({ version: { ...state.version!, practice_type: type } })
      await screen.findByText(`Result ${content.sections.at(-1)!.id}`); await ready()
      fireEvent.click(screen.getByRole('button', { name: 'Перейти к самопроверке' }))
      expect(review).toHaveBeenCalledWith({ completed: true, document_id: 44, document_revision: 1 }, expect.objectContaining({ title: definition.title }))
    })
  }

  it('offers a saved lecture only in response to an assistant source offer and sends its ID', async () => {
    mockedAll.mockImplementation(async path => path === 'workspace/source-lectures/'
      ? [{ id: 8, title: 'Сохранённая лекция', updated_at: '' }] as never : structuredClone(messages) as never)
    const original = mockedApi.getMockImplementation()!
    mockedApi.mockImplementation((path, method, data) => path.endsWith('/workspace/') || path === 'workspace/documents/44/'
      ? Promise.resolve({ ...document, content: {}, document_type: 'practical_session' } as never) : original(path, method, data))
    messages = [{ id: 1, operation: 71, role: 'assistant', text: 'Можно выбрать готовую лекцию или продолжить по теме.', offer_source_lecture: true, created_at: '' }]
    operation.status = 'SUCCEEDED'
    mount({ version: { ...state.version!, practice_type: 'practical_workshop' } })
    const sourceSelect = await screen.findByRole('combobox', { name: 'Созданная лекция' })
    await waitFor(() => expect((sourceSelect as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(sourceSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Сохранённая лекция' }))
    fireEvent.click(screen.getByRole('button', { name: 'Отправить запрос' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/operations/', 'POST',
      expect.objectContaining({ source_lecture_id: 8, kind: 'chat', prompt: 'Подготовь практическое занятие по выбранной лекции.' })))
  })

  it('accepts pasted lecture text without showing or fetching saved lectures', async () => {
    const original = mockedApi.getMockImplementation()!
    mockedApi.mockImplementation((path, method, data) => path.endsWith('/workspace/') || path === 'workspace/documents/44/'
      ? Promise.resolve({ ...document, content: {}, document_type: 'practical_session' } as never) : original(path, method, data))
    mount({ version: { ...state.version!, practice_type: 'practical_workshop' }, submission: null })
    expect(screen.queryByRole('combobox', { name: 'Созданная лекция' })).toBeNull()
    const text = 'Создай практику по лекции: Формирующее оценивание помогает выявить пробелы. Обратная связь направляет обучение.'
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить запрос' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/operations/', 'POST', expect.objectContaining({ prompt: text })))
    expect(mockedAll).not.toHaveBeenCalledWith('workspace/source-lectures/')
    const input = mockedApi.mock.calls.find(([path]) => path.endsWith('/operations/'))![2]
    expect(input).not.toHaveProperty('source_lecture_id')
  })

  it('offers all eight pedagogical formats and includes the selected format in the request', async () => {
    const original = mockedApi.getMockImplementation()!
    mockedApi.mockImplementation((path, method, data) => path.endsWith('/workspace/') || path === 'workspace/documents/44/'
      ? Promise.resolve({ ...document, content: {}, document_type: 'pedagogical_scenario' } as never) : original(path, method, data))
    mount({ version: { ...state.version!, practice_type: 'pedagogical_workshop' }, submission: null })
    expect(screen.getByRole('group', { name: 'Формат занятия' }).querySelectorAll('button')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Деловая игра' }))
    expect(screen.getByRole('button', { name: 'Деловая игра' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Управление конфликтами' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить запрос' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/operations/', 'POST',
      expect.objectContaining({ prompt: 'Формат занятия: Деловая игра.\nУправление конфликтами' })))
  })

})
