import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LectureEditor } from './LectureEditor'
import { sectionIds, type Lecture } from './types'
import { LearningLayout } from '../layouts/LearningLayout'
import { MemoryRouter } from 'react-router-dom'

const lecture: Lecture = { title: 'Учебная лекция', sections: sectionIds.map(id => ({ id, title: id, content: {
  type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Учебный материал' }] }] } })) }
const rangeRects = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects')
const rangeBounds = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
afterEach(() => {
  cleanup(); vi.restoreAllMocks()
  for (const [name, descriptor] of [['getClientRects', rangeRects], ['getBoundingClientRect', rangeBounds]] as const) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor)
    else Reflect.deleteProperty(Range.prototype, name)
  }
})

describe('real lecture editor', () => {
  it('opens structured JSON in the existing Tiptap editor and emits compatible list content', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) })
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) })
    const changed = vi.fn()
    const { container } = render(<LectureEditor content={lecture} dirty={false} disabled={false} readOnly={false} saving={false} conflict={false} onChange={changed} onSave={vi.fn()}/>)
    await waitFor(() => expect(container.querySelector('.tiptap')?.textContent).toBe('Учебный материал'))
    fireEvent.click(screen.getByRole('button', { name: 'Нумерованный список' }))
    await waitFor(() => expect(changed).toHaveBeenCalled())
    const result = changed.mock.lastCall![0] as Lecture
    expect(result.sections[0]!.id).toBe('goal')
    expect(result.sections[0]!.content.content?.[0]?.type).toBe('orderedList')
    expect(result.sections[0]!.content.content?.[0]?.content?.[0]?.type).toBe('listItem')
    expect(result.sections[0]!.content.content?.[0]?.content?.[0]?.content?.[0]?.type).toBe('paragraph')
  })
  it('shows a submitted section without mounting an editable surface', () => {
    const { container } = render(<LectureEditor content={lecture} dirty={false} disabled readOnly saving={false} conflict={false} onChange={vi.fn()} onSave={vi.fn()}/>)
    expect(screen.getByText('Учебный материал')).toBeTruthy()
    expect(container.querySelector('[contenteditable="true"]')).toBeNull()
  })
  it('keeps course navigation available in the two-panel layout', () => {
    render(<MemoryRouter><LearningLayout workspace lessonId="workshop" lessonTitle="Мастерская"><p>Workspace</p></LearningLayout></MemoryRouter>)
    expect(screen.queryByRole('complementary', { name: 'AI Tutor' })).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Содержание курса' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Содержание' }))
    expect(screen.getByRole('dialog', { name: 'Содержание курса' })).toBeTruthy()
  })
})
