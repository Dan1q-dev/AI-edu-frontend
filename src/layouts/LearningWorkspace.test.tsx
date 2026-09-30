import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LearningLayout } from './LearningLayout'
import type { LearningItem, Module } from '../api'

const module: Module = { id: 1, short_id: 'module-1', course: 1, title: 'Основы', description: '', position: 0, is_published: true }
const lecture: LearningItem = { id: 1, short_id: 'lecture-1', module: 1, type: 'LECTURE', title: 'Введение', description: '', position: 0, status: 'PUBLISHED', lesson: 1, lesson_short_id: 'lesson-1', test: null, practice: null }
const test: LearningItem = { ...lecture, id: 2, short_id: 'test-1', type: 'TEST', title: 'Проверка', position: 1, lesson: null, lesson_short_id: null, test: 1 }

afterEach(cleanup)

describe('learning workspace', () => {
  it('shows the course navigation and saved progress beside the lesson', () => {
    render(<MemoryRouter><LearningLayout courseTitle="Курс" moduleTitle="Основы" lessonId={lecture.short_id} lessonTitle={lecture.title} sections={[{ module, lessons: [lecture, test] }]} currentIndex={0} totalLessons={2} next={test} courseProgress={40} itemProgress={{ [lecture.short_id]: { progress_percent: 80, is_completed: false } }}><h1>Введение</h1></LearningLayout></MemoryRouter>)
    expect(screen.getByRole('complementary', { name: 'Содержание курса' })).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'AI Tutor' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Следующий элемент: Проверка/ }).getAttribute('href')).toBe('/items/test-1')
  })

  it('opens a course drawer from the compact header', () => {
    render(<MemoryRouter><LearningLayout lessonId={lecture.short_id} lessonTitle={lecture.title} sections={[{ module, lessons: [lecture] }]}><p>Материал</p></LearningLayout></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Содержание' }))
    expect(screen.getByRole('button', { name: 'Содержание' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('button', { name: 'Закрыть оглавление' })).toHaveLength(2)
  })
})
