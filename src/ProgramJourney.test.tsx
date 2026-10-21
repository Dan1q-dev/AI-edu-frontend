import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { api, apiAll } from './api'
import { ProgramJourney, type Journey, type JourneyModule } from './ProgramJourney'
import { TrackOnboarding } from './TrackOnboarding'

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), api: vi.fn(), apiAll: vi.fn() }))
let client: QueryClient
const first: JourneyModule = { short_id: 'm1', title: 'Введение', is_locked: false, is_completed: false, content_completed: false, completed_items: 0, total_items: 2, target_id: 'lecture', test_id: 'test1', test_passed: false, last_score: null, passing_percent: 70 }
const journey: Journey = { course_id: 'course', title: 'Программа ИИ', track_title: 'IT', enabled: true, hours: 72, configured: true, required_modules: 3, completed_modules: 0, total_modules: 3, can_issue: false, certificate: null, modules: [first, { ...first, short_id: 'm2', title: 'Нейронные сети', is_locked: true, target_id: null }, { ...first, short_id: 'm3', title: 'Распознавание образов', is_locked: true, target_id: null }] }
beforeEach(() => { vi.mocked(api).mockReset(); vi.mocked(apiAll).mockReset(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }) })
afterEach(async () => { cleanup(); await client.cancelQueries(); client.clear() })
function mount(component: React.ReactNode) { render(<QueryClientProvider client={client}><MemoryRouter>{component}</MemoryRouter></QueryClientProvider>) }

it('shows three ordered modules and cannot issue or link to locked modules', async () => {
  vi.mocked(api).mockResolvedValue(journey)
  mount(<ProgramJourney courseId="course"/>)
  await screen.findByRole('heading', { name: 'Программа ИИ' })
  expect(screen.getAllByRole('article')).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'Начать' }).getAttribute('href')).toBe('/items/lecture')
  expect(screen.queryByRole('link', { name: 'Пройти тест' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Получить сертификат' }) as HTMLButtonElement).disabled).toBe(true)
})

it('unlocks only the module test after materials are complete', async () => {
  vi.mocked(api).mockResolvedValue({ ...journey, modules: [{ ...first, content_completed: true }] })
  mount(<ProgramJourney courseId="course"/>)
  expect((await screen.findByRole('link', { name: 'Пройти тест' })).getAttribute('href')).toBe('/items/test1')
})

it('issues a certificate only on request and displays the PDF and QR from the server', async () => {
  const certificate = { token: 'cert', number: 'AI-cert', learner_name: 'Анна Иванова', course_title: 'Программа ИИ', track_title: 'IT', hours: 72, completed_at: '2026-10-21T00:00:00Z', issued_at: '2026-10-21T00:00:00Z', revoked: false, download_url: '/api/v1/certificates/cert/download/' }
  let issued = false
  vi.mocked(api).mockImplementation(async (_, method) => { if (method === 'POST') { issued = true; return certificate as never } return { ...journey, can_issue: true, certificate: issued ? certificate : null } as never })
  mount(<ProgramJourney courseId="course"/>)
  fireEvent.click(await screen.findByRole('button', { name: 'Получить сертификат' }))
  expect((await screen.findByRole('link', { name: 'Скачать PDF' })).getAttribute('href')).toBe(certificate.download_url)
  expect(vi.mocked(api)).toHaveBeenCalledWith('courses/course/certificate/', 'POST')
  fireEvent.click(screen.getByRole('button', { name: 'QR-код' }))
  expect(screen.getByAltText('QR-код сертификата').getAttribute('src')).toBe('/api/v1/certificates/cert/qr/')
})

it('chooses the trajectory after registration and refreshes the user session', async () => {
  vi.mocked(apiAll).mockResolvedValue([{ id: 1, title: 'Для IT-специальностей', description: '' }] as never)
  vi.mocked(api).mockResolvedValue({ id: 2, role: 'STUDENT', learning_track: { id: 1 } } as never)
  mount(<TrackOnboarding/>)
  fireEvent.click(await screen.findByRole('radio', { name: 'Для IT-специальностей' }))
  fireEvent.click(screen.getByRole('button', { name: 'Начать обучение' }))
  await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledWith('auth/me/', 'PATCH', { learning_track: 1 }))
  expect(client.getQueryData(['me'])).toMatchObject({ learning_track: { id: 1 } })
})
