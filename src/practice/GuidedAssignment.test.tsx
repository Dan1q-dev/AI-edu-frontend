import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PracticeFlow } from './PracticeFlow'
import { getPracticePlugin } from './registry'
import { RichLessonContent } from '../components/RichLessonContent'
import type { PracticeState } from './types'
import type { LearningItem } from '../api'

const instructions = JSON.stringify({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
  { type: 'tableCell', attrs: { backgroundColor: '#17365d' }, content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Подготовьте собственный сценарий', marks: [{ type: 'textStyle', attrs: { color: '#ffffff' } }] },
  ] }] },
] }] }] })
const state: PracticeState = { version: { id: 1, practice_definition: 1, practice_type: 'guided_assignment', plugin_version: '1.0.0',
  version_number: 1, title: 'Практическая работа 2', description: 'Учебная дискуссия', status: 'PUBLISHED', published_at: null,
  config: { instructions: [instructions], criteria: [{ title: 'Проверены источники', description: 'Исправлены неточности', is_required: true }], source_url: 'https://docs.google.com/document/d/source/edit' } },
  current_version_id: 1, submission: null, result: null, progress_percent: 0, is_completed: false }
const report = 'Я подготовил учебный сценарий, сверил факты с источником и исправил формулировки вопросов.'
const item = { short_id: 'assignment', type: 'PRACTICE' } as LearningItem
const clients: QueryClient[] = []
function mount(current = state, submit = vi.fn(async () => true)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); clients.push(client)
  return render(<QueryClientProvider client={client}><PracticeFlow state={current} plugin={getPracticePlugin('guided_assignment', '1.0.0')!}
    item={item} busy={false} start={vi.fn(async () => true)} submit={submit}/></QueryClientProvider>)
}
async function enter() {
  fireEvent.click(screen.getByRole('button', { name: 'Начать выполнение' }))
  await screen.findByLabelText(/Отчёт о выполнении/)
}
beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()) })

describe('shared practical assignment flow', () => {
  it('starts with instructions, criteria and source, without opening the tool', () => {
    mount()
    expect(screen.getByRole('cell').textContent).toContain('Подготовьте собственный сценарий')
    expect(screen.getByRole('cell').style.backgroundColor).toBe('rgb(23, 54, 93)')
    expect(screen.getByRole('link', { name: 'Исходный документ' }).getAttribute('href')).toContain('docs.google.com')
    expect(screen.getByText('Проверены источники')).toBeTruthy()
    expect(screen.queryByLabelText(/Отчёт о выполнении/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Завершить работу' })).toBeNull()
  })
  it('submits only after report entry and a separate self-check', async () => {
    const submit = vi.fn(async () => true)
    mount(state, submit); await enter()
    expect((screen.getByRole('button', { name: 'Перейти к самопроверке' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Отчёт о выполнении/), { target: { value: report } })
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к самопроверке' }))
    expect(submit).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Завершить работу' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Завершить работу' }))
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ report, artifact_url: '', checks: [true] }))
  })
  it('keeps report text and checked criteria when navigating back and reloading', async () => {
    const first = mount(); await enter()
    fireEvent.change(screen.getByLabelText(/Отчёт о выполнении/), { target: { value: report } })
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к самопроверке' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить редактирование' }))
    expect((await screen.findByLabelText(/Отчёт о выполнении/) as HTMLTextAreaElement).value).toBe(report)
    fireEvent.click(screen.getByRole('button', { name: 'Перейти к самопроверке' }))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    first.unmount(); mount()
    expect(screen.queryByLabelText(/Отчёт о выполнении/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^3Самопроверка$|3 Самопроверка/ }))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(report)).toBeTruthy()
  })
  it('shows submitted evidence and identifies self-assessment correctly', () => {
    const completed: PracticeState = { ...state, is_completed: true, result: { self_assessment_score: 1, automatic_score: null,
      teacher_score: null, effective_score: 1, grading_source: 'SELF_ASSESSMENT', psi_value: 1, psi_source: 'SELF_ASSESSMENT' },
      submission: { id: 1, status: 'SUBMITTED', practice_version: 1, submission_data: { report, artifact_url: '', checks: [true] },
        criteria_snapshot: [], started_at: '', submitted_at: '', completed_at: '' } }
    mount(completed)
    fireEvent.click(screen.getByRole('button', { name: /^3Самопроверка$|3 Самопроверка/ }))
    expect(screen.getByText(report)).toBeTruthy()
    expect(screen.getByText(/Не является оценкой преподавателя или ИИ/)).toBeTruthy()
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Завершить работу' })).toBeNull()
  })
  it('rejects unsafe links before moving to self-check', async () => {
    mount(); await enter()
    fireEvent.change(screen.getByLabelText(/Отчёт о выполнении/), { target: { value: report } })
    fireEvent.change(screen.getByLabelText(/Ссылка на результат/), { target: { value: 'javascript:alert(1)' } })
    expect((screen.getByRole('button', { name: 'Перейти к самопроверке' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('does not render arbitrary CSS in imported table cells', () => {
    render(<RichLessonContent value={instructions.replace('#17365d', 'url(https://invalid.example/image)')}/>)
    expect(screen.getByRole('cell').style.backgroundColor).toBe('')
  })
})
