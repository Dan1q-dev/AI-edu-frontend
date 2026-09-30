import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { LearningItem, Module } from '../api'
import { LearningLayout } from './LearningLayout'

const module: Module = { id: 1, short_id: 'module-1', course: 1, title: 'Введение', description: '', position: 0, is_published: true }
const base: LearningItem = { id: 1, short_id: 'lecture-1', module: 1, type: 'LECTURE', title: 'Лекция', description: '', position: 0, status: 'PUBLISHED', lesson: 1, lesson_short_id: 'old-lesson', test: null, practice: null }
const practice: LearningItem = { ...base, id: 2, short_id: 'practice-2', type: 'PRACTICE', title: 'Практика', position: 1, lesson: null, lesson_short_id: null, practice: 2 }
const test: LearningItem = { ...base, id: 3, short_id: 'test-3', type: 'TEST', title: 'Тест', position: 2, lesson: null, lesson_short_id: null, test: 3 }

describe('learning item navigation', () => {
  it('moves from a lecture to a practice and then a test', () => {
    render(<MemoryRouter><LearningLayout courseTitle="Курс" lessonId={base.short_id} lessonTitle={base.title} sections={[{ module, lessons: [base, practice, test] }]} currentIndex={0} totalLessons={3} next={practice}><p>Содержание</p></LearningLayout></MemoryRouter>)
    expect(screen.getByRole('link', { name: /Следующий элемент.*Практика/ }).getAttribute('href')).toBe('/items/practice-2')
    expect(screen.getByText('1 из 3')).toBeTruthy()
  })
})
