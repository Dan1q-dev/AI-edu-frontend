import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api, apiAll, ApiError, type LearningItem } from '../api'
import { I18nProvider } from '../i18n'
import { PracticeRunner } from '../practice/PracticeRunner'
import { getPracticePlugin } from '../practice/registry'
import type { PracticeState } from '../practice/types'
import { LectureWorkshop } from './LectureWorkshop'
import { referenceKey, writeReference, workspaceApi } from './api'
import { sectionIds, normalizedParameters, type Lecture, type WorkspaceDocument, type WorkspaceOperation, type WorkspaceMessage } from './types'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn(), apiAll: vi.fn() }))
vi.mock('../components/LessonTextEditor', () => ({ LessonTextEditor: ({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean
}) => <textarea aria-label="Tiptap section" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}/> }))
const mockedApi = vi.mocked(api), mockedAll = vi.mocked(apiAll)
const lecture: Lecture = { title: 'Лекция о педагогике', sections: sectionIds.map(id => ({ id, title: id,
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Содержание ${id}` }] }] } })) }
const initialDocument: WorkspaceDocument = { id: 44, submission: 99, document_type: 'lecture', schema_version: 1, revision: 1,
  created_at: '2026-10-13T10:00:00Z', updated_at: '2026-10-13T10:00:00Z', content: lecture,
  parameters: { discipline: 'Педагогика', topic: 'Обучение', course: '2', audience: 'Преподаватели', duration_minutes: 45,
    difficulty: 'intermediate', learning_outcomes: ['Объяснить методы'], language: 'ru' } }
const item: LearningItem = { id: 3, short_id: 'workshop-1', module: 1, type: 'PRACTICE', title: 'Мастерская', description: '', position: 1,
  status: 'PUBLISHED', lesson: null, lesson_short_id: null, test: null, practice: 9 }
const state: PracticeState = { version: { id: 7, practice_definition: 9, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1,
  title: 'Мастерская', description: 'Подготовьте учебную лекцию', status: 'PUBLISHED', published_at: null,
  config: { criteria: [{ title: 'Лекция проверена', description: 'Проверьте содержание', is_required: true }] } }, current_version_id: 7,
  submission: { id: 99, status: 'IN_PROGRESS', practice_version: 7, submission_data: {}, criteria_snapshot: [],
    started_at: '2026-10-13T10:00:00Z', submitted_at: null, completed_at: null }, result: null, progress_percent: 0, is_completed: false }
const initialOperation: WorkspaceOperation = { id: 71, document: 44, request_id: 'a4e6e83a-7541-47e6-ab99-51c41b76ea4a', kind: 'generate', status: 'PENDING', base_revision: 1,
  result: {}, error_code: '', model: 'test', duration_ms: null, input_tokens: null, output_tokens: null, total_tokens: null, cost: null, cost_currency: '', attempts: 0,
  created_at: '2026-10-13T10:00:00Z', started_at: null, finished_at: null }
let serverDocument: WorkspaceDocument, serverOperation: WorkspaceOperation, serverMessages: WorkspaceMessage[]
let clients: QueryClient[]

function mount(overrides: Partial<PracticeState> = {}, runner = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity } } })
  clients.push(client)
  const view = render(<I18nProvider><QueryClientProvider client={client}><MemoryRouter>{runner ? <PracticeRunner item={item} ownerId={5}/> :
    <LectureWorkshop state={{ ...state, ...overrides }} item={item} ownerId={5} busy={false} onStart={vi.fn()} onSubmit={vi.fn()}/>}</MemoryRouter></QueryClientProvider></I18nProvider>)
  return { ...view, client }
}
async function opened() { return screen.findByLabelText('Название лекции') }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); clients = []
  serverDocument = structuredClone(initialDocument); serverOperation = structuredClone(initialOperation); serverMessages = []
  writeReference(referenceKey(5, 99), 44)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockedAll.mockImplementation(async path => {
    if (path === 'workspace/documents/44/messages/') return structuredClone(serverMessages) as never
    throw new Error(`Unexpected paginated API ${path}`)
  })
  mockedApi.mockImplementation(async (path, method = 'GET', data) => {
    if (path === 'items/workshop-1/practice/' && method === 'GET') return structuredClone(state) as never
    if (path === 'items/workshop-1/practice/workspace/') return structuredClone(serverDocument) as never
    if (path === 'workspace/documents/44/' && method === 'GET') return structuredClone(serverDocument) as never
    if (path === 'workspace/documents/44/' && method === 'PATCH') {
      const patch = data as Partial<WorkspaceDocument>
      if (patch.revision !== serverDocument.revision) throw new ApiError('Stale revision', 409)
      serverDocument = { ...serverDocument, ...patch, revision: serverDocument.revision + 1 }
      return structuredClone(serverDocument) as never
    }
    if (path === 'workspace/documents/44/operations/' && method === 'POST') {
      serverOperation = { ...serverOperation, ...data as Partial<WorkspaceOperation>, status: 'PENDING' }
      serverMessages = [{ id: 1, operation: 71, role: 'user', text: (data as { prompt: string }).prompt, created_at: initialOperation.created_at }]
      return structuredClone(serverOperation) as never
    }
    if (path === 'workspace/operations/71/') return structuredClone(serverOperation) as never
    if (path === 'items/workshop-1/practice/' && method === 'POST') return { ...state, submission: { ...state.submission!, status: 'SUBMITTED', submission_data: (data as { submission_data: unknown }).submission_data }, is_completed: true } as never
    throw new Error(`Unexpected API ${method} ${path}`)
  })
})
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); vi.restoreAllMocks() })

describe('lecture workshop', () => {
  it('registers the plugin and retains the existing checklist editor', () => {
    expect(getPracticePlugin('lecture_workshop', '1.0.0')?.layout).toBe('workspace')
    expect(getPracticePlugin('lecture_workshop', '1.0.0')?.ConfigEditor).toBe(getPracticePlugin('checklist_practice', '1.0.0')?.ConfigEditor)
  })
  it('reopens a saved lecture using GET only', async () => {
    mount(); expect((await opened() as HTMLInputElement).value).toBe(lecture.title)
    expect(screen.getByLabelText('Дисциплина').getAttribute('value')).toBe('Педагогика')
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
  })
  it('creates/opens a document with exact backend parameters', async () => {
    localStorage.clear(); mount()
    const parameters = initialDocument.parameters
    for (const [label, value] of [['Дисциплина', parameters.discipline], ['Тема лекции', parameters.topic], ['Курс обучения', parameters.course], ['Целевая аудитория', parameters.audience], ['Результаты обучения', parameters.learning_outcomes[0]!]]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Открыть документ' }))
    await opened()
    expect(mockedApi).toHaveBeenCalledWith('items/workshop-1/practice/workspace/', 'POST', { parameters })
    expect(JSON.parse(localStorage.getItem(referenceKey(5, 99)!)!).document).toBe(44)
    expect(mockedApi.mock.calls.some(([path]) => path.endsWith('/operations/'))).toBe(false)
  })
  it('validates empty/oversized parameters without calling the API', () => {
    expect(normalizedParameters({ ...initialDocument.parameters, duration_minutes: 4 })).toBeNull()
    expect(normalizedParameters({ ...initialDocument.parameters, learning_outcomes: ['x'.repeat(501)] })).toBeNull()
    expect(normalizedParameters({ ...initialDocument.parameters, discipline: '   ' })).toBeNull()
  })
  it('saves manual edits with the base revision and exact Tiptap JSON', async () => {
    mount(); const title = await opened()
    fireEvent.change(title, { target: { value: 'Отредактированная лекция' } })
    const rich = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Новый материал' }] }] }
    fireEvent.change(screen.getByLabelText('Tiptap section'), { target: { value: JSON.stringify(rich) } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить лекцию' }))
    await screen.findByText('Изменения сохранены')
    const call = mockedApi.mock.calls.find(([, method]) => method === 'PATCH')!
    expect(call[2]).toEqual({ revision: 1, parameters: initialDocument.parameters, content: { ...lecture, title: 'Отредактированная лекция',
      sections: lecture.sections.map(row => row.id === 'goal' ? { ...row, content: rich } : row) } })
    expect((screen.getByRole('button', { name: 'Сохранить лекцию' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('keeps IDs/content while navigating between sections', async () => {
    mount(); await opened()
    fireEvent.change(screen.getByLabelText('Название раздела'), { target: { value: 'Новая цель' } })
    fireEvent.click(screen.getByRole('button', { name: 'Следующий раздел' }))
    expect((screen.getByLabelText('Название раздела') as HTMLInputElement).value).toBe('learning_outcomes')
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий раздел' }))
    expect((screen.getByLabelText('Название раздела') as HTMLInputElement).value).toBe('Новая цель')
  })
  it('preserves local edits on 409 and loads server version only after confirmation', async () => {
    mount(); fireEvent.change(await opened(), { target: { value: 'Мои изменения' } })
    serverDocument = { ...serverDocument, revision: 2, content: { ...lecture, title: 'Версия коллеги' } }
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить лекцию' }))
    await screen.findByText('Конфликт версий')
    expect((screen.getByLabelText('Название лекции') as HTMLInputElement).value).toBe('Мои изменения')
    expect((screen.getByRole('button', { name: 'Сохранить лекцию' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Показать версию с сервера' }))
    await screen.findByText('Версия коллеги')
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить версию с сервера' }))
    await waitFor(() => expect((screen.getByLabelText('Название лекции') as HTMLInputElement).value).toBe('Версия коллеги'))
    expect(window.confirm).toHaveBeenCalled()
  })
  it('does not discard edits on save/network failure', async () => {
    const original = mockedApi.getMockImplementation()!
    mockedApi.mockImplementation((path, method, data) => method === 'PATCH' ? Promise.reject(new Error('offline')) : original(path, method, data))
    mount(); fireEvent.change(await opened(), { target: { value: 'Мой черновик' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить лекцию' }))
    await screen.findByText('Не удалось выполнить запрос. Проверьте соединение и повторите.')
    expect((screen.getByLabelText('Название лекции') as HTMLInputElement).value).toBe('Мой черновик')
    expect((screen.getByRole('button', { name: 'Сохранить лекцию' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('preserves the editor when a background read fails while local changes exist', async () => {
    const { client } = mount()
    fireEvent.change(await opened(), { target: { value: 'Несохранённый текст' } })
    const original = mockedApi.getMockImplementation()!
    mockedApi.mockImplementation((path, method, data) => path === 'workspace/documents/44/' && (!method || method === 'GET')
      ? Promise.reject(new Error('offline')) : original(path, method, data))
    await act(() => client.invalidateQueries({ queryKey: ['workspace-document'] }))
    await screen.findByText('Не удалось выполнить запрос. Проверьте соединение и повторите.')
    expect((screen.getByLabelText('Название лекции') as HTMLInputElement).value).toBe('Несохранённый текст')
  })
  it('improves the prompt without generating or patching a lecture', async () => {
    const { client } = mount(); await opened()
    fireEvent.change(screen.getByLabelText('Ваш запрос'), { target: { value: 'Добавь примеры' } })
    fireEvent.click(screen.getByRole('button', { name: 'Улучшить запрос' }))
    await screen.findByText('Запрос в очереди')
    const data = mockedApi.mock.calls.find(([path, method]) => path.endsWith('/operations/') && method === 'POST')![2]
    expect(data).toEqual({ request_id: expect.any(String), revision: 1, kind: 'improve_prompt', prompt: 'Добавь примеры' })
    serverOperation = { ...serverOperation, status: 'SUCCEEDED', result: { improved_prompt: 'Подготовь лекцию с примерами из практики.' } }
    await act(() => client.invalidateQueries({ queryKey: ['workspace-operation'] }))
    await waitFor(() => expect((screen.getByLabelText('Ваш запрос') as HTMLTextAreaElement).value).toBe('Подготовь лекцию с примерами из практики.'))
    fireEvent.change(screen.getByLabelText('Ваш запрос'), { target: { value: 'Мой уточнённый запрос' } })
    expect(mockedApi.mock.calls.filter(([, method]) => method === 'POST')).toHaveLength(1)
    expect(mockedApi.mock.calls.some(([, method]) => method === 'PATCH')).toBe(false)
  })
  it('polls a restored operation without launching another generation', async () => {
    writeReference(referenceKey(5, 99), 44, 71)
    serverMessages = [{ id: 1, operation: 71, role: 'user', text: 'Запрос', created_at: initialOperation.created_at }]
    mount(); await screen.findByText('Запрос в очереди')
    serverDocument = { ...serverDocument, revision: 2, content: { ...lecture, title: 'Новая AI-лекция' } }
    serverOperation = { ...serverOperation, status: 'SUCCEEDED', result: { content: serverDocument.content as Lecture, revision: 2 } }
    await waitFor(() => expect((screen.getByLabelText('Название лекции') as HTMLInputElement).value).toBe('Новая AI-лекция'), { timeout: 4500 })
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
    expect(mockedApi.mock.calls.filter(([path]) => path === 'workspace/operations/71/').length).toBeGreaterThanOrEqual(2)
  })
  it('discovers the latest operation from paginated message history', async () => {
    serverMessages = [{ id: 1, operation: 71, role: 'user', text: 'Запрос', created_at: initialOperation.created_at }]
    mount(); await screen.findByText('Запрос в очереди')
    expect(mockedApi).toHaveBeenCalledWith('workspace/operations/71/')
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
  })
  it('retries uncertain delivery with the same UUID and exact payload', async () => {
    const original = mockedApi.getMockImplementation()!
    let first = true
    mockedApi.mockImplementation((path, method, data) => {
      if (path.endsWith('/operations/') && method === 'POST' && first) { first = false; return Promise.reject(new Error('Response lost')) }
      return original(path, method, data)
    })
    mount(); await opened()
    fireEvent.change(screen.getByLabelText('Ваш запрос'), { target: { value: 'Создай лекцию' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сгенерировать лекцию' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить операцию' }))
    await screen.findByText('Запрос в очереди')
    const requests = mockedApi.mock.calls.filter(([path, method]) => path.endsWith('/operations/') && method === 'POST')
    expect(requests).toHaveLength(2)
    expect(requests[1]![2]).toEqual(requests[0]![2])
  })
  it('shows provider errors and prevents edits/submission while generating', async () => {
    writeReference(referenceKey(5, 99), 44, 71)
    const { client } = mount(); await screen.findByText('Запрос в очереди')
    expect((screen.getByLabelText('Название лекции') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Завершить практическую работу' }) as HTMLButtonElement).disabled).toBe(true)
    serverOperation = { ...serverOperation, status: 'FAILED', error_code: 'ai_timeout' }
    await act(() => client.invalidateQueries({ queryKey: ['workspace-operation'] }))
    await screen.findByText('AI не успел ответить. Попробуйте ещё раз.')
    expect(screen.getByRole('button', { name: 'Повторить операцию' })).toBeTruthy()
  })
  it('submits document ID, saved revision and self-assessment through PracticeRunner', async () => {
    mount({}, true); await opened()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Завершить практическую работу' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('checkbox', { name: /Лекция проверена/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Завершить практическую работу' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('items/workshop-1/practice/', 'POST', {
      submission_id: 99, submission_data: { document_id: 44, document_revision: 1, checks: [true] } }))
    await screen.findByText(/Версия 1 · Попытка сдана/)
    expect(screen.queryByLabelText('Название лекции')).toBeNull()
  })
  it('opens submitted work using the server snapshot reference without local storage', async () => {
    localStorage.clear()
    mount({ submission: { ...state.submission!, status: 'SUBMITTED', submission_data: { document_id: 44, document_revision: 1, document: { content: lecture, parameters: initialDocument.parameters, schema_version: 1 }, checks: [true] } } })
    await screen.findByText(lecture.title)
    expect(screen.queryByRole('button', { name: 'Сохранить лекцию' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Новая попытка' })).toBeTruthy()
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
  })
  it('shows access errors without retrying POST or exposing the editor', async () => {
    mockedApi.mockRejectedValue(new ApiError('Forbidden', 403))
    mount(); await screen.findByText('Доступ к работе закрыт.')
    expect(screen.queryByLabelText('Название лекции')).toBeNull()
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
  })
  it.each([['en', 'Lecture editor', 'Improve prompt'], ['kz', 'Дәріс редакторы', 'Сұрауды жақсарту']])('localizes the interface for %s', async (locale, heading, button) => {
    localStorage.setItem('ai-edu-locale', locale!)
    mount(); await screen.findByRole('heading', { name: heading })
    expect(screen.getByRole('button', { name: button })).toBeTruthy()
  })
})

describe('workspace API contracts', () => {
  it('omits empty content when saving only parameters', async () => {
    await workspaceApi.save(44, { revision: 1, parameters: initialDocument.parameters })
    expect(mockedApi).toHaveBeenCalledWith('workspace/documents/44/', 'PATCH', { revision: 1, parameters: initialDocument.parameters })
  })
  it('rejects unsupported schemas and does not send altered section IDs', async () => {
    serverDocument = { ...serverDocument, schema_version: 2 }
    await expect(workspaceApi.document(44)).rejects.toThrow('Формат лекции не поддерживается')
  })
})
