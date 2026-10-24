import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from '../api'
import { AnalyticsPage } from './AnalyticsPage'
import { analyticsCsv } from './analytics'
import { analyticsFixture } from '../../e2e/fixtures/analytics'

vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), api: vi.fn() }))
const mockApi = vi.mocked(api)
function Location() { return <output data-testid="location">{useLocation().search}</output> }
function mount(path = '/admin/analytics') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}><AnalyticsPage/><Location/></MemoryRouter>
  </QueryClientProvider>)
}
beforeEach(() => { mockApi.mockReset(); mockApi.mockResolvedValue(analyticsFixture) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('shows real aggregates, definitions and links to curriculum details', async () => {
  mount()
  const table = await screen.findByRole('table', { name: 'Статистика курсов' })
  const row = within(table).getAllByRole('row')[1]
  expect(within(row).getByText('40')).toBeTruthy()
  expect(within(row).getByText('18')).toBeTruthy()
  expect(within(row).getByText('30%')).toBeTruthy()
  expect(within(row).getByRole('link').getAttribute('href')).toBe('/admin/curriculum/courses/python')
  expect(screen.getByText('120')).toBeTruthy()
  expect(screen.getByText('Как считаются показатели')).toBeTruthy()
  expect(mockApi).toHaveBeenCalledWith('admin/analytics/?period=30d')
})

it('reads URL filters and clears the dependent course when switching track', async () => {
  mount('/admin/analytics?period=7d&track=1&course=1')
  await screen.findByRole('table')
  expect(mockApi).toHaveBeenCalledWith('admin/analytics/?period=7d&track=1&course=1')
  fireEvent.click(screen.getByRole('combobox', { name: 'Траектория' }))
  fireEvent.click(screen.getByRole('option', { name: 'Траектория 2: для других специальностей' }))
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('admin/analytics/?period=7d&track=2'))
  expect(screen.getByTestId('location').textContent).toBe('?period=7d&track=2')
})

it('switches to modules and searches by title or parent course', async () => {
  mount()
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'Модули (2)' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Промпт' } })
  const table = screen.getByRole('table', { name: 'Статистика модулей' })
  expect(within(table).getByRole('link', { name: 'Практическое применение' }).getAttribute('href')).toBe('/admin/curriculum/modules/practice')
  expect(within(table).queryByText('Основы искусственного интеллекта')).toBeNull()
})

it('renders empty state without inventing activity', async () => {
  mockApi.mockResolvedValue({ ...analyticsFixture, summary: { ...analyticsFixture.summary, started_students: 0,
    active_students: 0, completed_students: 0, item_count: 0 }, tracks: [], courses: [], modules: [] })
  mount()
  expect(await screen.findByText('Нет опубликованных учебных элементов')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Экспорт CSV' }) as HTMLButtonElement).disabled).toBe(true)
})

it('shows errors, supports retry and resets invalid URL filters', async () => {
  mockApi.mockRejectedValueOnce(new Error('Unavailable'))
  mount('/admin/analytics?period=invalid')
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }))
  await waitFor(() => expect(mockApi).toHaveBeenCalledWith('admin/analytics/?period=30d'))
  expect(screen.getByTestId('location').textContent).toBe('')
})

it('CSV preserves non-Latin text, delimiters and neutralises spreadsheet formulas', () => {
  const csv = analyticsCsv([['Название', 'a;b', '"quoted"'], ['=HYPERLINK("bad")', ' +formula', 12]])
  expect(csv.startsWith('\uFEFF')).toBe(true)
  expect(csv).toContain('"Название";"a;b";"""quoted"""')
  expect(csv).toContain('"\'=HYPERLINK(""bad"")";"\' +formula";"12"')
})
