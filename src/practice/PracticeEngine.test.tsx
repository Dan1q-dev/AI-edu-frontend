import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api, type LearningItem } from '../api'
import { PracticeRunner } from './PracticeRunner'
import { PracticeEditorPage } from './PracticeEditor'
import type { PracticeManifest, PracticeState, PracticeVersion } from './types'
import { registerPractice } from './registry'
import { normalizeTaskConfig } from './commonTask'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn(), apiAll: vi.fn() }))
const mockedApi = vi.mocked(api)
const item: LearningItem = { id: 1, short_id: 'p1', module: 1, title: 'Current title', description: '', type: 'PRACTICE', position: 0, status: 'PUBLISHED', lesson: null, lesson_short_id: null, test: null, practice: 1 }
const version: PracticeVersion = { id: 7, practice_definition: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1, title: 'Pinned task', description: 'Original instructions', config: {}, status: 'PUBLISHED', published_at: null }
const state: PracticeState = { version, current_version_id: 7, submission: null, result: null, progress_percent: 0, is_completed: false }
const submission = { id: 2, status: 'IN_PROGRESS', practice_version: 7, submission_data: {}, criteria_snapshot: [], started_at: '', submitted_at: null, completed_at: null }
const workshop: PracticeManifest = { type: 'lecture_workshop', version: '1.0.0', name: 'Виртуальная мастерская генерации лекции', description: 'Lecture workshop',
  icon: 'sparkles', grading: 'completion', capabilities: [], available: true, config_schema: {}, frontend_editor: 'lecture_workshop', student_runtime: 'lecture_workshop' }
const second: PracticeManifest = { ...workshop, type: 'selection_test_second', name: 'Вторая практика', icon: 'puzzle' }
const third: PracticeManifest = { ...workshop, type: 'selection_test_third', name: 'Третья практика', icon: 'puzzle' }
registerPractice({ type: second.type, version: second.version, initialConfig: () => ({ mode: 'second' }), ConfigEditor: () => <p>Настройки второй практики</p>, StudentRuntime: () => null,
  validateConfig: config => config.mode === 'second' ? null : 'Invalid config' })
registerPractice({ type: third.type, version: third.version, initialConfig: () => ({ mode: 'third' }), ConfigEditor: () => null, StudentRuntime: () => null, validateConfig: () => null })

function mockEditor({ published = version, draft = null, catalog = [workshop, second, third] }: { published?: PracticeVersion | null; draft?: PracticeVersion | null; catalog?: PracticeManifest[] | Error } = {}) {
  mockedApi.mockImplementation(async (path, method = 'GET', data) => {
    if (path === 'practice-types/') {
      if (catalog instanceof Error) throw catalog
      return catalog as never
    }
    if (method === 'PUT') { draft = { ...version, ...data as object, status: 'DRAFT', id: 8 }; return draft as never }
    if (method === 'POST') { published = { ...draft!, status: 'PUBLISHED' }; draft = null; return published as never }
    return { draft, published, versions: [published, draft].filter(Boolean) } as never
  })
}
let clients: QueryClient[] = []
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { mockedApi.mockReset(); localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients = []; vi.restoreAllMocks() })

describe('Practice Engine completion', () => {
  it('opens the assignment first and starts the selected tool without completing it', async () => {
    mockedApi.mockImplementation(async (path, method = 'GET') => {
      if (path.endsWith('/start/')) return { ...state, submission } as never
      if (method === 'POST') return { ...state, submission: { ...submission, status: 'SUBMITTED' }, is_completed: true, progress_percent: 100 } as never
      return state as never
    })
    mount(<PracticeRunner item={item}/>)
    await screen.findByRole('button', { name: 'Начать выполнение' })
    expect(screen.queryByText(version.description)).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Ваш запрос' })).toBeNull()
    expect(mockedApi.mock.calls.some(([, method]) => method === 'POST')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Начать выполнение' }))
    await screen.findByRole('textbox', { name: 'Ваш запрос' })
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/start/', 'POST')
    expect(mockedApi.mock.calls.some(([path, method]) => path === 'items/p1/practice/' && method === 'POST')).toBe(false)
  })
  it('keeps the task visible when starting the attempt fails', async () => {
    mockedApi.mockImplementation(async (_path, method = 'GET') => {
      if (method === 'POST') throw new Error('offline')
      return state as never
    })
    mount(<PracticeRunner item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Начать выполнение' }))
    await screen.findByText('offline')
    expect((screen.getByRole('button', { name: 'Начать выполнение' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole('textbox', { name: 'Ваш запрос' })).toBeNull()
  })
  it('displays unsupported plugins safely', async () => {
    mockedApi.mockResolvedValue({ ...state, version: { ...version, practice_type: 'unknown' } } as never)
    mount(<PracticeRunner item={item}/>)
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
  it('uses the catalog to select a practice for a new assignment', async () => {
    mockEditor({ published: null })
    mount(<PracticeEditorPage item={item}/>)
    const catalog = await screen.findByRole('region', { name: 'Выберите тип практической работы' })
    fireEvent.click(await within(catalog).findByRole('button', { name: /Виртуальная мастерская/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }))
    await screen.findByText('Практика опубликована')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', { practice_type: 'lecture_workshop', plugin_version: '1.0.0', title: 'Current title', description: '', config: normalizeTaskConfig({}) })
  })
  it('keeps the existing type and settings when only editing a title', async () => {
    const config = { criteria: [{ title: 'Original criterion', description: '', is_required: true }] }
    mockEditor({ published: { ...version, practice_type: 'checklist_practice', config } })
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Updated title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await screen.findByText('Черновик сохранён')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', expect.objectContaining({ practice_type: 'checklist_practice', title: 'Updated title', config: normalizeTaskConfig(config) }))
  })
})

describe('changing the assigned practice', () => {
  it('replaces the selected practice on the same item and retains title and keeps the legacy description hidden', async () => {
    mockEditor()
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Custom title' } })
    expect(screen.queryByLabelText('Описание')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Изменить практику' }))
    const catalog = screen.getByRole('region', { name: 'Выберите тип практической работы' })
    expect((await within(catalog).findByRole('button', { name: /Виртуальная мастерская/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(catalog).getByRole('button', { name: /Вторая практика/ }))
    expect(screen.getByRole('heading', { name: 'Вторая практика' })).toBeTruthy()
    expect(screen.getByText('Настройки второй практики')).toBeTruthy()
    expect(screen.getByLabelText('Название').getAttribute('value')).toBe('Custom title')
    expect(screen.queryByLabelText('Описание')).toBeNull()
    expect(mockedApi.mock.calls.some(([, method]) => method === 'PUT')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Обновить публикацию' }))
    await screen.findByText('Практика опубликована')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', {
      practice_type: second.type, plugin_version: second.version, title: 'Custom title', description: version.description, config: { mode: 'second' },
    })
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'POST')
  })
  it('reopens the saved choice and can change it again to a third practice', async () => {
    mockEditor()
    const view = mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить практику' }))
    fireEvent.click(await screen.findByRole('button', { name: /Вторая практика/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await screen.findByText('Черновик сохранён')
    view.unmount()
    mount(<PracticeEditorPage item={item}/>)
    await screen.findByRole('heading', { name: 'Вторая практика' })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить практику' }))
    fireEvent.click(await screen.findByRole('button', { name: /Третья практика/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Обновить публикацию' }))
    await screen.findByText('Практика опубликована')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', expect.objectContaining({ practice_type: third.type, config: { mode: 'third' } }))
  })
  it('closing the catalog keeps the current selection and unsaved text', async () => {
    mockEditor()
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.change(await screen.findByLabelText('Название'), { target: { value: 'Unsaved title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить практику' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть выбор' }))
    expect(screen.getByRole('heading', { name: workshop.name })).toBeTruthy()
    expect(screen.getByLabelText('Название').getAttribute('value')).toBe('Unsaved title')
    expect(mockedApi.mock.calls.some(([, method]) => method === 'PUT')).toBe(false)
  })
  it('explains when the catalog has no alternative practices', async () => {
    mockEditor({ catalog: [workshop] })
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить практику' }))
    expect(await screen.findByText('Других доступных практик пока нет.')).toBeTruthy()
  })
  it('disables practices with no frontend implementation or unavailable catalog entries', async () => {
    mockEditor({ catalog: [workshop, { ...second, available: false }, { ...third, type: 'unknown_plugin' }] })
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить практику' }))
    expect((await screen.findByRole('button', { name: /Вторая практика/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Третья практика/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('shows catalog failures and allows retrying without changing the selected practice', async () => {
    mockEditor({ catalog: new Error('Catalog offline') })
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить практику' }))
    await screen.findByText('Catalog offline')
    expect(screen.getByLabelText('Название').getAttribute('value')).toBe('Pinned task')
    mockEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('button', { name: /Вторая практика/ })).toBeTruthy()
  })
  it('preserves the new selection after a failed save', async () => {
    mockEditor()
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить практику' }))
    fireEvent.click(await screen.findByRole('button', { name: /Вторая практика/ }))
    mockedApi.mockRejectedValueOnce(new Error('Save offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await screen.findByText('Save offline')
    expect(screen.getByRole('heading', { name: 'Вторая практика' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('requires an explicit selection to replace a legacy practice', async () => {
    mockEditor({ published: { ...version, practice_type: 'checklist_practice', config: { criteria: [{ title: 'Old', description: '', is_required: true }] } } })
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить практику' }))
    fireEvent.click(await screen.findByRole('button', { name: /Виртуальная мастерская/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Обновить публикацию' }))
    await screen.findByText('Практика опубликована')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', expect.objectContaining({ practice_type: 'lecture_workshop', config: normalizeTaskConfig({ criteria: [{ title: 'Old', description: '', is_required: true }] }) }))
  })
})
