import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { api, apiAll, type Course, type Lesson, type Module, type Track } from '../api'
import { AdminCurriculum } from './CurriculumExplorer'
import { CurriculumEntityPage } from './CurriculumEntityPage'

vi.mock('../api', () => ({ api: vi.fn(), apiAll: vi.fn() }))
const mockedApi = vi.mocked(api)
const mockedApiAll = vi.mocked(apiAll)
const track: Track = { id: 1, short_id: 'track-1', title: 'Разработка', description: '', cover: null, is_published: true, is_active: true, is_system: false }
const course: Course = { id: 2, short_id: 'course-2', title: 'Основы Python', slug: 'python', description: '', learning_track: 1, cover: null, position: 0, is_published: true }
const moduleItem: Module = { id: 3, short_id: 'module-3', title: 'Введение', description: '', course: 2, position: 0, is_published: true }
const lesson: Lesson = { id: 4, short_id: 'lesson-4', title: 'Первый урок', description: '', module: 3, position: 0, status: 'DRAFT' }
let modules: Module[]
let lessons: Lesson[]

function renderExplorer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/curriculum']}><Routes>
    <Route path="/admin/curriculum" element={<AdminCurriculum/>}/>
    <Route path="/admin/curriculum/courses/:courseId" element={<><div>Страница курса</div><Link to="/admin/curriculum">Назад</Link></>}/>
    <Route path="/admin/curriculum/modules/:moduleId" element={<div>Страница модуля</div>}/>
    <Route path="/admin/curriculum/lessons/:id/edit" element={<div>Редактор урока</div>}/>
  </Routes></MemoryRouter></QueryClientProvider>)
}

function renderEntity(kind: 'course' | 'module') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const path = kind === 'course' ? '/admin/curriculum/courses/course-2' : '/admin/curriculum/modules/module-3'
  const pattern = kind === 'course' ? '/admin/curriculum/courses/:courseId' : '/admin/curriculum/modules/:moduleId'
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={<CurriculumEntityPage kind={kind}/>}/></Routes></MemoryRouter></QueryClientProvider>)
}

beforeEach(() => {
  modules = [moduleItem]
  lessons = [lesson]
  mockedApi.mockReset()
  mockedApiAll.mockReset()
  mockedApiAll.mockImplementation(async path => {
    if (path === 'tracks/') return [track] as never
    if (path === 'courses/') return [course] as never
    if (path === 'modules/') return modules as never
    if (path === 'lessons/') return lessons as never
    return [] as never
  })
})
afterEach(cleanup)

describe('curriculum explorer', () => {
  it('switches the visible course list with the selected track', async () => {
    const secondTrack = { ...track, id: 8, short_id: 'track-8', title: 'Дизайн' }
    const secondCourse = { ...course, id: 9, short_id: 'course-9', slug: 'design', learning_track: 8, title: 'Основы дизайна' }
    mockedApiAll.mockImplementation(async path => {
      if (path === 'tracks/') return [track, secondTrack] as never
      if (path === 'courses/') return [course, secondCourse] as never
      if (path === 'modules/') return modules as never
      if (path === 'lessons/') return lessons as never
      return [] as never
    })
    renderExplorer()
    await screen.findByRole('link', { name: 'Основы Python' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Траектория обучения' }), { target: { value: 'track-8' } })
    expect(await screen.findByRole('link', { name: 'Основы дизайна' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Основы Python' })).toBeNull()
  })

  it('navigates directly from course, module, and lesson names', async () => {
    renderExplorer()
    await screen.findByRole('link', { name: 'Основы Python' })
    expect(screen.getByRole('link', { name: 'Введение' }).getAttribute('href')).toContain('/admin/curriculum/modules/module-3')
    expect(screen.getByRole('link', { name: 'Первый урок' }).getAttribute('href')).toContain('/admin/curriculum/lessons/lesson-4/edit')
    fireEvent.click(screen.getByRole('link', { name: 'Основы Python' }))
    expect(await screen.findByText('Страница курса')).toBeTruthy()
  })

  it('creates a module and confirms deletion from a row menu', async () => {
    mockedApi.mockImplementation(async (path, method, body) => {
      if (path === 'modules/' && method === 'POST') {
        const created: Module = { ...moduleItem, id: 5, short_id: 'module-5', title: (body as { title: string }).title, position: 1 }
        modules = [...modules, created]
        return created as never
      }
      if (path === 'lessons/lesson-4/' && method === 'DELETE') { lessons = []; return undefined as never }
      return {} as never
    })
    renderExplorer()
    await screen.findByRole('link', { name: 'Первый урок' })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить модуль в курс Основы Python' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название' }), { target: { value: 'Продолжение' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('modules/', 'POST', expect.objectContaining({ title: 'Продолжение', course: 2 })))
    await screen.findByRole('link', { name: 'Продолжение' })
    fireEvent.click(screen.getByRole('button', { name: 'Действия: Первый урок' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Первый урок')
    fireEvent.click(dialog.querySelector('.button.danger') as HTMLElement)
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith('lessons/lesson-4/', 'DELETE'))
  })

  it.each([
    ['course', 'courses/course-2/', 'Новое название курса'],
    ['module', 'modules/module-3/', 'Новое название модуля'],
  ] as const)('saves %s settings on its own page', async (kind, endpoint, title) => {
    mockedApi.mockImplementation(async (path, method, body) => {
      if (path === endpoint && method === 'PATCH') return { ...(kind === 'course' ? course : moduleItem), ...(body as object) } as never
      if (path === endpoint) return (kind === 'course' ? course : moduleItem) as never
      return {} as never
    })
    renderEntity(kind)
    await screen.findByRole('heading', { name: kind === 'course' ? 'Настройки курса' : 'Настройки модуля' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Название' }), { target: { value: title } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(endpoint, 'PATCH', expect.objectContaining({ title })))
  })
})
