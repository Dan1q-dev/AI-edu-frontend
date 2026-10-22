import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GuidedAssignment } from './GuidedAssignment'
import { RichLessonContent } from '../components/RichLessonContent'
import type { PracticeState } from './types'

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
afterEach(cleanup)

describe('Source-based practical assignments', () => {
  it('renders original tables and source link without a lecture generator', () => {
    render(<GuidedAssignment state={state} busy={false} onStart={vi.fn()} onSubmit={vi.fn()}/>)
    expect(screen.getByRole('cell').textContent).toContain('Подготовьте собственный сценарий')
    expect(screen.getByRole('cell').style.backgroundColor).toBe('rgb(23, 54, 93)')
    expect(screen.getByRole('link', { name: 'Исходный документ' }).getAttribute('href')).toContain('docs.google.com')
    expect(screen.queryByPlaceholderText('Напишите запрос для генерации лекции…')).toBeNull()
  })
  it('requires a report and criteria before submitting the actual result', () => {
    const submit = vi.fn()
    render(<GuidedAssignment state={state} busy={false} onStart={vi.fn()} onSubmit={submit}/>)
    fireEvent.click(screen.getByRole('tab', { name: 'Результат работы' }))
    const button = screen.getByRole('button', { name: 'Сдать работу' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Отчёт о выполнении/), { target: { value: report } })
    expect(button.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledWith({ report, artifact_url: '', checks: [true] })
  })
  it('retains submitted evidence and labels self-assessment honestly', () => {
    const completed: PracticeState = { ...state, is_completed: true, progress_percent: 100, submission: {
      id: 5, status: 'SUBMITTED', practice_version: 1, submission_data: { report, artifact_url: '', checks: [true] },
      criteria_snapshot: [], started_at: '', submitted_at: '', completed_at: '',
    } }
    render(<GuidedAssignment state={completed} busy={false} onStart={vi.fn()} onSubmit={vi.fn()}/>)
    fireEvent.click(screen.getByRole('tab', { name: 'Результат работы' }))
    expect((screen.getByLabelText(/Отчёт о выполнении/) as HTMLTextAreaElement).value).toBe(report)
    expect(screen.getByText(/Не является оценкой преподавателя или ИИ/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Сдать работу' })).toBeNull()
  })
  it('rejects unsafe links without sending the report', () => {
    render(<GuidedAssignment state={state} busy={false} onStart={vi.fn()} onSubmit={vi.fn()}/>)
    fireEvent.click(screen.getByRole('tab', { name: 'Результат работы' }))
    fireEvent.change(screen.getByLabelText(/Отчёт о выполнении/), { target: { value: report } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText(/Ссылка на результат/), { target: { value: 'javascript:alert(1)' } })
    expect((screen.getByRole('button', { name: 'Сдать работу' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('does not render arbitrary CSS in imported table cells', () => {
    render(<RichLessonContent value={instructions.replace('#17365d', 'url(https://invalid.example/image)')}/>)
    expect(screen.getByRole('cell').style.backgroundColor).toBe('')
  })
})
