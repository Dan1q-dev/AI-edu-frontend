import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api, type LearningItem } from '../api'
import { PracticeRunner } from './PracticeRunner'
import { PracticeEditorPage } from './PracticeEditor'
import type { PracticeState, PracticeVersion } from './types'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn(), apiAll: vi.fn() }))
const mockedApi = vi.mocked(api)
const item: LearningItem = { id: 1, short_id: 'p1', module: 1, title: 'Current title', description: '', type: 'PRACTICE', position: 0, status: 'PUBLISHED', lesson: null, lesson_short_id: null, test: null, practice: 1 }
const version: PracticeVersion = { id: 7, practice_definition: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1, title: 'Pinned task', description: 'Original instructions', config: {}, status: 'PUBLISHED', published_at: null }
const state: PracticeState = { version, current_version_id: 7, submission: null, result: null, progress_percent: 0, is_completed: false }
const submission = { id: 2, status: 'IN_PROGRESS', practice_version: 7, submission_data: {}, criteria_snapshot: [], started_at: '', submitted_at: null, completed_at: null }
let clients: QueryClient[] = []
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => { mockedApi.mockReset(); localStorage.clear() })
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients = [] })

describe('Practice Engine completion', () => {
  it('starts and completes a practice with one Done click and no generated document', async () => {
    mockedApi.mockImplementation(async (path, method = 'GET') => {
      if (path.endsWith('/start/')) return { ...state, submission } as never
      if (method === 'POST') return { ...state, submission: { ...submission, status: 'SUBMITTED' }, is_completed: true, progress_percent: 100 } as never
      return state as never
    })
    mount(<PracticeRunner item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Сделано' }))
    await screen.findByRole('button', { name: 'Выполнено' })
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/', 'POST', { submission_id: 2, submission_data: { completed: true } })
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
  it('leaves the practice open after a failed completion request', async () => {
    mockedApi.mockImplementation(async (_path, method = 'GET') => {
      if (method === 'POST') throw new Error('offline')
      return { ...state, submission } as never
    })
    mount(<PracticeRunner item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Сделано' }))
    await screen.findByText('offline')
    expect((screen.getByRole('button', { name: 'Сделано' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('displays unsupported plugins safely', async () => {
    mockedApi.mockResolvedValue({ ...state, version: { ...version, practice_type: 'unknown' } } as never)
    mount(<PracticeRunner item={item}/>)
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
  it('publishes the workshop directly without type selection or criteria', async () => {
    mockedApi.mockImplementation(async (_path, method) => method === 'PUT' || method === 'POST' ? version as never : { draft: null, published: null, versions: [] } as never)
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Опубликовать' }))
    await screen.findByText('Практика опубликована')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', { practice_type: 'lecture_workshop', plugin_version: '1.0.0', title: 'Current title', description: '', config: {} })
    expect(screen.queryByText('Выберите тип практической работы')).toBeNull()
    expect(screen.queryByText('Критерии самопроверки')).toBeNull()
    expect(mockedApi.mock.calls.some(([path]) => path === 'practice-types/')).toBe(false)
  })
  it('upgrades old checklist configuration when saving', async () => {
    mockedApi.mockImplementation(async (_path, method) => method === 'PUT' || method === 'POST' ? version as never : { draft: null, published: { ...version, practice_type: 'checklist_practice', config: { criteria: [] } }, versions: [] } as never)
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: 'Обновить публикацию' }))
    await screen.findByText('Практика опубликована')
    expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', expect.objectContaining({ practice_type: 'lecture_workshop', config: {} }))
  })
})
