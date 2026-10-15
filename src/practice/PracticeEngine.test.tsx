import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api, type LearningItem } from '../api'
import { PracticeRunner } from './PracticeRunner'
import { PracticeEditorPage } from './PracticeEditor'
import type { PracticeManifest, PracticeState, PracticeVersion } from './types'

vi.mock('../api', () => ({ api: vi.fn() }))
const mockedApi = vi.mocked(api)
const item: LearningItem = { id: 1, short_id: 'p1', module: 1, title: 'Current title', description: '', type: 'PRACTICE', position: 0, status: 'PUBLISHED', lesson: null, lesson_short_id: null, test: null, practice: 1 }
const version: PracticeVersion = { id: 7, practice_definition: 1, practice_type: 'checklist_practice', plugin_version: '1.0.0', version_number: 1, title: 'Pinned task', description: 'Original instructions', config: { criteria: [{ title: 'Criterion', description: 'Details', is_required: true }] }, status: 'PUBLISHED', published_at: null }
const state: PracticeState = { version, current_version_id: 8, submission: null, result: null, progress_percent: 0, is_completed: false }
const manifest: PracticeManifest = { type: 'checklist_practice', version: '1.0.0', name: 'Практика с самооценкой', description: 'Критерии выполнения и Ψ', grading: 'self_assessment', icon: 'list-checks', capabilities: ['criteria'], available: true, config_schema: {}, frontend_editor: 'checklist_practice', student_runtime: 'checklist_practice' }
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => mockedApi.mockReset())
afterEach(cleanup)

describe('Practice Engine', () => {
  it('starts an attempt before enabling the checklist', async () => {
    mockedApi.mockResolvedValueOnce(state as never).mockResolvedValueOnce({ ...state, submission: { id: 2, status: 'IN_PROGRESS', submission_data: {} } } as never)
    mount(<PracticeRunner item={item}/>)
    expect(await screen.findByText('Original instructions')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Criterion/ }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Начать практическую работу' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/start/', 'POST', undefined))
    await waitFor(() => expect((screen.getByRole('checkbox', { name: /Criterion/ }) as HTMLInputElement).disabled).toBe(false))
  })

  it('shows the server score and a retry action for a submitted attempt', async () => {
    mockedApi.mockResolvedValue({ ...state, submission: { id: 2, status: 'SUBMITTED', submission_data: { checks: [true] } }, result: { psi_value: .75, psi_source: 'SELF_ASSESSMENT' }, progress_percent: 75 } as never)
    mount(<PracticeRunner item={item}/>)
    expect(await screen.findByText('Самооценка: Ψ = 0.75')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Новая попытка' })).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Criterion/ }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Это ваша самооценка. Система не проверяет выполненную работу автоматически.')).toBeTruthy()
  })

  it('displays unsupported plugins safely', async () => {
    mockedApi.mockResolvedValue({ ...state, version: { ...version, practice_type: 'unknown' } } as never)
    mount(<PracticeRunner item={item}/>)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('builds catalog cards from manifests and publishes through the version API', async () => {
    mockedApi.mockImplementation(async (path, method) => {
      if (path === 'practice-types/') return [manifest, { ...manifest, type: 'python_ide', name: 'Python IDE', available: false }] as never
      if (method === 'PUT') return version as never
      if (method === 'POST') return version as never
      return { draft: null, published: null, versions: [] } as never
    })
    mount(<PracticeEditorPage item={item}/>)
    expect(await screen.findByRole('heading', { name: 'Выберите тип практической работы' })).toBeTruthy()
    expect((screen.getByRole('button', { name: /Python IDE/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Практика с самооценкой/ }))
    fireEvent.change(screen.getByLabelText('Критерий 1'), { target: { value: 'My criterion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'PUT', {
      practice_type: 'checklist_practice', plugin_version: '1.0.0', title: 'Current title', description: '', config: { criteria: [{ title: 'My criterion', description: '', is_required: true }] },
    }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('items/p1/practice/draft/', 'POST'))
    expect(await screen.findByText('Практика опубликована')).toBeTruthy()
  })

  it('keeps invalid configuration in the editor without sending it', async () => {
    mockedApi.mockImplementation(async path => path === 'practice-types/' ? [manifest] as never : { draft: null, published: null, versions: [] } as never)
    mount(<PracticeEditorPage item={item}/>)
    fireEvent.click(await screen.findByRole('button', { name: /Практика с самооценкой/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(mockedApi.mock.calls.some(([, method]) => method === 'PUT')).toBe(false)
  })
})
