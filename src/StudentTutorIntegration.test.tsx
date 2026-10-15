import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api, apiAll, type LearningItem, type User } from './api'
import { LearningItemPage } from './StudentPages'

vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), api: vi.fn(), apiAll: vi.fn() }))

const user: User = { id: 1, email: 'student@example.test', first_name: 'Ada', last_name: '', role: 'STUDENT', learning_track: null }
const lecture: LearningItem = { id: 1, short_id: 'lecture', module: 1, title: 'Lecture', description: '', type: 'LECTURE', position: 0, status: 'PUBLISHED', lesson: 1, lesson_short_id: 'lesson', test: null, practice: null, course_short_id: 'course' }
const practice: LearningItem = { ...lecture, id: 2, short_id: 'workshop', title: 'Workshop', type: 'PRACTICE', lesson: null, lesson_short_id: null, practice: 1 }
let client: QueryClient

beforeEach(() => {
  vi.mocked(api).mockReset()
  vi.mocked(apiAll).mockReset().mockResolvedValue([])
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  client.setQueryData(['me'], user)
})
afterEach(async () => {
  cleanup()
  await client.cancelQueries()
  client.clear()
  sessionStorage.clear()
})

function mount(item: LearningItem) {
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/items/${item.short_id}`]}><Routes><Route path="/items/:id" element={<LearningItemPage user={user}/>}/></Routes></MemoryRouter></QueryClientProvider>)
}

it('keeps the lecture tutor alongside course navigation, account menu and attachments', async () => {
  vi.mocked(api).mockImplementation(async path => {
    if (path === 'items/lecture/') return lecture as never
    if (path.endsWith('/progress/')) return { percent: 0, items: {} } as never
    if (path.endsWith('/attachments/')) return [{ media: 1, name: 'Lecture notes.pdf', size: 100, url: '/api/v1/media/1/' }] as never
    return [] as never
  })
  mount(lecture)
  expect(await screen.findByLabelText('Вопрос тьютору')).toBeTruthy()
  expect(screen.getAllByRole('link', { name: 'Вернуться к курсу' })[0].getAttribute('href')).toBe('/courses/course')
  expect(screen.getByLabelText('Меню пользователя')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Lecture notes.pdf/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Открыть тьютора' }))
  expect(screen.getByRole('dialog', { name: 'ИИ-тьютор' })).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'ИИ-тьютор' })).toBeNull()
  expect(screen.getByLabelText('Вопрос тьютору')).toBeTruthy()
})

it('still opens a lecture workshop as a document workspace without the lecture tutor', async () => {
  vi.mocked(api).mockImplementation(async path => {
    if (path === 'items/workshop/') return practice as never
    if (path.endsWith('/progress/')) return { percent: 0, items: {} } as never
    if (path === 'items/workshop/practice/') return {
      version: { id: 1, practice_definition: 1, practice_type: 'lecture_workshop', plugin_version: '1.0.0', version_number: 1, title: 'Workshop task', description: '', config: { criteria: [{ title: 'Reviewed', description: '', is_required: true }] }, status: 'PUBLISHED', published_at: null },
      current_version_id: 1, submission: null, result: null, progress_percent: 0, is_completed: false,
    } as never
    return [] as never
  })
  mount(practice)
  expect(await screen.findByRole('button', { name: 'Начать практическую работу' })).toBeTruthy()
  expect(document.querySelector('.is-document-workspace')).toBeTruthy()
  expect(screen.queryByLabelText('Вопрос тьютору')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Открыть тьютора' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Содержание' })).toBeTruthy()
})
