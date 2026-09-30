import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api, apiAll, type Course, type Lesson, type Module, type Track } from '../api'
import { Confirm, ErrorState, Loading, Notice } from '../components/ui'
import { CreateEntityDialog } from './CreateEntityDialog'
import { CurriculumHeader } from './CurriculumHeader'
import { CourseSection, type CourseGroup } from './CurriculumTree'
import { entityKey, sortByPosition, type Entity, type EntityKind, type EntitySelection } from './types'
import '../admin-curriculum.css'

type Creation = { kind: EntityKind; parentId: number }
type Feedback = { text: string; kind: 'success' | 'error' }
const labels: Record<EntityKind, string> = { courses: 'Курс', modules: 'Модуль', lessons: 'Урок' }
const plural: Record<EntityKind, string> = { courses: 'курс', modules: 'модуль', lessons: 'урок' }
const nextPosition = (items: { position: number }[]) => Math.max(-1, ...items.map(item => item.position)) + 1

export function AdminCurriculum() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tracksQuery = useQuery({ queryKey: ['admin', 'tracks'], queryFn: () => apiAll<Track>('tracks/') })
  const coursesQuery = useQuery({ queryKey: ['admin', 'courses'], queryFn: () => apiAll<Course>('courses/') })
  const modulesQuery = useQuery({ queryKey: ['admin', 'modules'], queryFn: () => apiAll<Module>('modules/') })
  const lessonsQuery = useQuery({ queryKey: ['admin', 'lessons'], queryFn: () => apiAll<Lesson>('lessons/') })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [creation, setCreation] = useState<Creation | null>(null)
  const [deletion, setDeletion] = useState<EntitySelection | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  const tracks = tracksQuery.data ?? []
  const courses = coursesQuery.data ?? []
  const modules = modulesQuery.data ?? []
  const lessons = lessonsQuery.data ?? []
  const requestedTrack = params.get('track')
  const hasUnassigned = courses.some(course => course.learning_track === null)
  const selectedTrack = tracks.find(track => track.short_id === requestedTrack) ?? (requestedTrack === 'unassigned' && hasUnassigned ? null : tracks[0] ?? null)
  const trackKey = selectedTrack?.short_id ?? (hasUnassigned ? 'unassigned' : '')
  const needle = search.trim().toLocaleLowerCase()
  const groups = useMemo<CourseGroup[]>(() => {
    const visibleCourses = sortByPosition(courses.filter(course => selectedTrack ? course.learning_track === selectedTrack.id : trackKey === 'unassigned' && course.learning_track === null))
    return visibleCourses.map(course => {
      const allModules = sortByPosition(modules.filter(module => module.course === course.id))
      const courseMatch = course.title.toLocaleLowerCase().includes(needle)
      const groupedModules = allModules.map(module => {
        const allLessons = sortByPosition(lessons.filter(lesson => lesson.module === module.id))
        const moduleMatch = module.title.toLocaleLowerCase().includes(needle)
        const visibleLessons = !needle || courseMatch || moduleMatch ? allLessons : allLessons.filter(lesson => lesson.title.toLocaleLowerCase().includes(needle))
        return { module, lessons: visibleLessons, totalLessons: allLessons.length, matches: !needle || courseMatch || moduleMatch || visibleLessons.length > 0 }
      }).filter(group => group.matches)
      return { course, modules: groupedModules, totalModules: allModules.length, matches: !needle || courseMatch || groupedModules.length > 0 }
    }).filter(group => group.matches)
  }, [courses, modules, lessons, selectedTrack, trackKey, needle])
  const refresh = async () => { await Promise.all(['tracks', 'courses', 'modules', 'lessons'].map(kind => queryClient.invalidateQueries({ queryKey: ['admin', kind] }))) }
  const selectTrack = (key: string) => { setParams({ track: key }); setSearch(''); setFeedback(null) }
  const create = async (title: string) => {
    if (!creation) return
    const { kind, parentId } = creation
    const body = kind === 'courses'
      ? { title, learning_track: parentId, position: nextPosition(courses.filter(course => course.learning_track === parentId)) }
      : kind === 'modules'
        ? { title, course: parentId, position: nextPosition(modules.filter(module => module.course === parentId)) }
        : { title, module: parentId, position: nextPosition(lessons.filter(lesson => lesson.module === parentId)), status: 'DRAFT' }
    const result = await api<Entity>(`${kind}/`, 'POST', body)
    await refresh()
    setExpanded(current => ({ ...current, ...(kind === 'modules' ? { [`course-${parentId}`]: true } : kind === 'lessons' ? { [`module-${parentId}`]: true } : {}) }))
    setFeedback({ text: `${labels[kind]} «${result.title}» создан. Нажмите на название, чтобы открыть настройки.`, kind: 'success' })
  }
  const destroy = async () => {
    if (!deletion || busy) return
    setBusy(true)
    try {
      const { kind, item } = deletion
      await api(`${kind}/${entityKey(kind, item)}/`, 'DELETE')
      await refresh()
      setFeedback({ text: `${labels[kind]} «${item.title}» удалён`, kind: 'success' })
      setDeletion(null)
    } catch (cause) { setFeedback({ text: cause instanceof Error ? cause.message : 'Не удалось удалить материал', kind: 'error' }); setDeletion(null) }
    finally { setBusy(false) }
  }
  const move = async ({ kind, item }: EntitySelection, delta: number) => {
    if (busy) return
    const siblings: Entity[] = kind === 'courses'
      ? sortByPosition(courses.filter(course => course.learning_track === (item as Course).learning_track))
      : kind === 'modules'
        ? sortByPosition(modules.filter(module => module.course === (item as Module).course))
        : sortByPosition(lessons.filter(lesson => lesson.module === (item as Lesson).module))
    const index = siblings.findIndex(sibling => sibling.id === item.id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= siblings.length) return
    ;[siblings[index], siblings[target]] = [siblings[target]!, siblings[index]!]
    setBusy(true)
    try {
      await Promise.all(siblings.map((sibling, position) => sibling.position === position ? Promise.resolve() : api(`${kind}/${entityKey(kind, sibling)}/`, 'PATCH', { position })))
      await refresh()
      setFeedback({ text: 'Порядок обновлён', kind: 'success' })
    } catch (cause) { await refresh(); setFeedback({ text: cause instanceof Error ? cause.message : 'Не удалось изменить порядок', kind: 'error' }) }
    finally { setBusy(false) }
  }
  const loading = tracksQuery.isLoading || coursesQuery.isLoading || modulesQuery.isLoading || lessonsQuery.isLoading
  const error = tracksQuery.error || coursesQuery.error || modulesQuery.error || lessonsQuery.error
  return <div className="curriculum-explorer">
    <CurriculumHeader tracks={tracks} trackKey={trackKey} hasUnassigned={hasUnassigned} search={search} onTrackChange={selectTrack} onSearchChange={setSearch} onCreateCourse={() => { if (selectedTrack) setCreation({ kind: 'courses', parentId: selectedTrack.id }) }}/>
    {feedback && <Notice text={feedback.text} kind={feedback.kind}/>}
    {loading ? <Loading/> : error ? <ErrorState error={error}/> : groups.length ? <div className="curriculum-course-list" aria-label="Структура учебных курсов">{groups.map((group, index) => <CourseSection key={group.course.id} group={group} index={index} length={groups.length} trackKey={trackKey} expanded={expanded} forceOpen={Boolean(needle)} onToggle={key => setExpanded(current => ({ ...current, [key]: !(current[key] ?? true) }))} onCreate={(kind, parentId) => setCreation({ kind, parentId })} onMove={(selection, delta) => void move(selection, delta)} onDelete={setDeletion}/>)}</div> : <div className="curriculum-empty"><h2>{needle ? 'Ничего не найдено' : 'Курсов пока нет'}</h2><p>{needle ? 'Попробуйте другое название курса, модуля или урока.' : selectedTrack ? 'Создайте первый курс в этой траектории.' : 'Выберите траекторию обучения.'}</p></div>}
    {creation && <CreateEntityDialog kind={creation.kind} onCreate={create} onClose={() => setCreation(null)}/ >}
    {deletion && <Confirm title={`Удалить ${plural[deletion.kind]} «${deletion.item.title}»?${deletion.kind === 'lessons' ? '' : ' Вложенные материалы также будут удалены.'}`} onConfirm={() => void destroy()} onCancel={() => setDeletion(null)}/ >}
  </div>
}
