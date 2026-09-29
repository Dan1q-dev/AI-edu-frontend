import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, CirclePlus, FileText, Layers3, Pencil, Search, Trash2 } from 'lucide-react'
import { api, apiAll, type Course, type Lesson, type Module, type Track } from './api'
import { Button, Confirm, ErrorState, Input, Loading, Notice, Textarea } from './components/ui'
import './admin-curriculum.css'

type Kind = 'tracks' | 'courses' | 'modules' | 'lessons'
type Selected = { kind: Kind; id: string }
type ContentItem = Track | Course | Module | Lesson
const isLesson = (item: ContentItem): item is Lesson => 'module' in item && 'status' in item
const isModule = (item: ContentItem): item is Module => 'course' in item && !('slug' in item)
const isCourse = (item: ContentItem): item is Course => 'slug' in item
const keyOf = (item: ContentItem) => isCourse(item) ? item.slug : item.short_id
const labelFor = (kind: Kind) => ({ tracks: 'Траектория', courses: 'Курс', modules: 'Модуль', lessons: 'Урок' })[kind]
const accusativeFor = (kind: Kind) => ({ tracks: 'траекторию', courses: 'курс', modules: 'модуль', lessons: 'урок' })[kind]
const isPublished = (item: ContentItem) => isLesson(item) ? item.status === 'PUBLISHED' : item.is_published
const endpoint = (kind: Kind, key?: string) => `${kind}/${key ? `${key}/` : ''}`

export function AdminCurriculum() {
  const qc = useQueryClient()
  const tracksQuery = useQuery({ queryKey: ['admin', 'tracks'], queryFn: () => apiAll<Track>('tracks/') })
  const coursesQuery = useQuery({ queryKey: ['admin', 'courses'], queryFn: () => apiAll<Course>('courses/') })
  const modulesQuery = useQuery({ queryKey: ['admin', 'modules'], queryFn: () => apiAll<Module>('modules/') })
  const lessonsQuery = useQuery({ queryKey: ['admin', 'lessons'], queryFn: () => apiAll<Lesson>('lessons/') })
  const [selected, setSelected] = useState<Selected | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ kind: Kind; item?: ContentItem; parentId?: number } | null>(null)
  const [form, setForm] = useState<Record<string, string | number | boolean>>({})
  const [remove, setRemove] = useState<Selected | null>(null)
  const [message, setMessage] = useState('')
  const tracks = tracksQuery.data ?? [], courses = coursesQuery.data ?? [], modules = modulesQuery.data ?? [], lessons = lessonsQuery.data ?? []
  const loading = tracksQuery.isLoading || coursesQuery.isLoading || modulesQuery.isLoading || lessonsQuery.isLoading
  const error = tracksQuery.error || coursesQuery.error || modulesQuery.error || lessonsQuery.error
  const needle = search.trim().toLocaleLowerCase()
  const matches = (value: string) => !needle || value.toLocaleLowerCase().includes(needle)
  const tree = useMemo(() => tracks.map(track => ({ track, courses: courses.filter(course => course.learning_track === track.id).map(course => ({
    course,
    modules: modules.filter(module => module.course === course.id).map(module => ({ module, lessons: lessons.filter(lesson => lesson.module === module.id) })),
  })) })).map(group => ({ ...group, courses: group.courses.map(item => ({ ...item, modules: item.modules.map(child => ({ ...child, lessons: child.lessons.filter(lesson => matches(lesson.title) || matches(child.module.title) || matches(item.course.title) || matches(group.track.title)) })).filter(child => matches(group.track.title) || matches(item.course.title) || matches(child.module.title) || child.lessons.length) })).filter(item => matches(group.track.title) || matches(item.course.title) || item.modules.length) })).filter(group => !needle || matches(group.track.title) || group.courses.length), [tracks, courses, modules, lessons, needle])
  const orphans = courses.filter(course => !course.learning_track && matches(course.title))
  const items: Record<Kind, ContentItem[]> = { tracks, courses, modules, lessons }
  const selectedItem = selected ? items[selected.kind].find(item => keyOf(item) === selected.id) : null
  const selectedCourse = selectedItem && isCourse(selectedItem) ? selectedItem : selectedItem && isModule(selectedItem) ? courses.find(course => course.id === selectedItem.course) : selectedItem && isLesson(selectedItem) ? courses.find(course => course.id === modules.find(module => module.id === selectedItem.module)?.course) : null
  const selectedModule = selectedItem && isModule(selectedItem) ? selectedItem : selectedItem && isLesson(selectedItem) ? modules.find(module => module.id === selectedItem.module) : null
  const selectedTrack = selectedItem && 'short_id' in selectedItem && !isCourse(selectedItem) && !isModule(selectedItem) && !isLesson(selectedItem) ? selectedItem as Track : selectedCourse?.learning_track ? tracks.find(track => track.id === selectedCourse.learning_track) : null
  const start = (kind: Kind, item?: ContentItem, parentId?: number) => {
    if (kind === 'tracks') return
    setEditing({ kind, item, parentId })
    setForm(item ? { ...item } as unknown as Record<string, string | number | boolean> : {
      title: '', description: '', position: 0, is_published: false, is_active: true, status: 'DRAFT',
      ...(kind === 'courses' ? { learning_track: parentId ?? tracks.find(track => track.is_active)?.id ?? 0, slug: '' } : {}),
      ...(kind === 'modules' ? { course: parentId ?? courses.find(course => course.learning_track)?.id ?? 0 } : {}),
      ...(kind === 'lessons' ? { module: parentId ?? modules[0]?.id ?? 0 } : {}),
    })
  }
  const refresh = async () => Promise.all(['tracks', 'courses', 'modules', 'lessons'].map(key => qc.invalidateQueries({ queryKey: ['admin', key] })))
  const save = async () => {
    if (!editing) return
    if (editing.kind === 'tracks') return
    try {
      const body = { ...form }
      for (const key of ['id', 'short_id', 'created_at', 'updated_at']) delete body[key]
      const key = editing.item ? keyOf(editing.item) : undefined
      const result = await api<ContentItem>(endpoint(editing.kind, key), key ? 'PATCH' : 'POST', body)
      await refresh(); setSelected({ kind: editing.kind, id: keyOf(result) }); setEditing(null); setMessage(`${labelFor(editing.kind)} сохранён`)
    } catch (e) { setMessage((e as Error).message) }
  }
  const destroy = async () => {
    if (!remove) return
    if (remove.kind === 'tracks') return
    try { await api(endpoint(remove.kind, remove.id), 'DELETE'); await refresh(); setSelected(null); setRemove(null); setMessage(`${labelFor(remove.kind)} удалён`) }
    catch (e) { setRemove(null); setMessage((e as Error).message) }
  }
  const toggle = (key: string) => setExpanded(value => ({ ...value, [key]: !(value[key] ?? true) }))
  const select = (kind: Kind, item: ContentItem) => setSelected({ kind, id: keyOf(item) })
  const treeRow = (kind: Kind, item: ContentItem, icon: React.ReactNode, indent = '') => <button key={`${kind}-${keyOf(item)}`} className={`tree-row ${indent} ${selected?.kind === kind && selected.id === keyOf(item) ? 'selected' : ''}`} onClick={() => select(kind, item)}>{icon}<span className="tree-label">{item.title}</span></button>

  return <>
    <div className="page-head curriculum-heading"><div><span className="eyebrow">УПРАВЛЕНИЕ КОНТЕНТОМ</span><h1>Учебная программа</h1><p>Траектория → курс → модуль → урок.</p></div></div>
    <Notice text={message} kind={message && !message.endsWith('сохранён') && !message.endsWith('удалён') && !message.endsWith('сохранена') && !message.endsWith('удалена') ? 'error' : 'success'}/>
    {loading ? <Loading/> : error ? <ErrorState error={error}/> : <section className="curriculum-workspace card">
      <aside className="curriculum-tree" aria-label="Структура учебной программы">
        <div className="curriculum-tree-head"><strong>Структура</strong><span>{tracks.length} траекторий · {courses.length} курсов</span></div>
        <label className="curriculum-search"><Search size={16}/><input aria-label="Поиск по программе" value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти материал"/></label>
        <div className="tree-scroll">
          {tree.map(({ track, courses: courseGroups }) => {
            const trackKey = `track-${track.id}`, open = needle.length > 0 || (expanded[trackKey] ?? true)
            return <div className="tree-group" key={track.id}>
              <div className={`tree-row ${selected?.kind === 'tracks' && selected.id === track.short_id ? 'selected' : ''}`}><button className="tree-toggle" aria-label={open ? 'Свернуть траекторию' : 'Развернуть траекторию'} onClick={() => toggle(trackKey)}>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button><button className="tree-item" onClick={() => select('tracks', track)}><Layers3 size={16}/><span>{track.title}</span></button><button className="tree-add" title="Добавить курс" onClick={() => start('courses', undefined, track.id)}><CirclePlus size={15}/></button></div>
              {open && courseGroups.map(({ course, modules: moduleGroups }) => { const key = `course-${course.id}`, courseOpen = needle.length > 0 || (expanded[key] ?? true); return <div className="tree-module" key={course.id}>
                <div className={`tree-row ${selected?.kind === 'courses' && selected.id === course.slug ? 'selected' : ''}`}><button className="tree-toggle" aria-label={courseOpen ? 'Свернуть курс' : 'Развернуть курс'} onClick={() => toggle(key)}>{courseOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button><button className="tree-item" onClick={() => select('courses', course)}><BookOpen size={15}/><span>{course.title}</span></button><button className="tree-add" title="Добавить модуль" onClick={() => start('modules', undefined, course.id)}><CirclePlus size={15}/></button></div>
                {courseOpen && moduleGroups.map(({ module, lessons: lessonItems }) => { const mkey = `module-${module.id}`, moduleOpen = needle.length > 0 || (expanded[mkey] ?? true); return <div className="tree-module" key={module.id}>
                  <div className={`tree-row ${selected?.kind === 'modules' && selected.id === module.short_id ? 'selected' : ''}`}><button className="tree-toggle" aria-label={moduleOpen ? 'Свернуть модуль' : 'Развернуть модуль'} onClick={() => toggle(mkey)}>{moduleOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button><button className="tree-item" onClick={() => select('modules', module)}><Layers3 size={14}/><span>{module.title}</span></button><button className="tree-add" title="Добавить урок" onClick={() => start('lessons', undefined, module.id)}><CirclePlus size={15}/></button></div>
                  {moduleOpen && lessonItems.map(lesson => treeRow('lessons', lesson, <FileText size={14}/>, 'tree-lesson'))}
                </div> })}
              </div> })}
            </div>
          })}
          {orphans.length > 0 && <div className="tree-group"><div className="curriculum-tree-head"><strong>Требуют траектории</strong><span>{orphans.length}</span></div>{orphans.map(course => treeRow('courses', course, <BookOpen size={15}/>,'tree-module'))}</div>}
          {!tree.length && !orphans.length && <div className="tree-empty">Ничего не найдено</div>}
        </div>
      </aside>
      <div className="curriculum-detail">
        {!selectedItem ? <div className="curriculum-welcome"><div className="curriculum-welcome-icon"><Layers3 size={25}/></div><h2>Выберите материал</h2><p>Выберите существующую траекторию, чтобы добавить курсы, модули и уроки.</p></div> : <>
          <div className="detail-top"><div><span className="eyebrow">{labelFor(selected!.kind).toLocaleUpperCase()}</span><h2>{selectedItem.title}</h2></div><span className={`status ${isPublished(selectedItem) ? 'published' : ''}`}>{isPublished(selectedItem) ? 'Опубликовано' : 'Черновик'}</span></div>
          <div className="curriculum-breadcrumb">{selectedTrack && <><span>{selectedTrack.title}</span><span>›</span></>}{selectedCourse && selected?.kind !== 'courses' && <><span>{selectedCourse.title}</span><span>›</span></>}{selectedModule && selected?.kind === 'lessons' && <><span>{selectedModule.title}</span><span>›</span></>}<strong>{selectedItem.title}</strong></div>
          <p className="detail-description">{selectedItem.description || 'Описание пока не добавлено.'}</p>
          <div className="detail-facts">
            {selected?.kind === 'tracks' && <><div><span>Курсов</span><strong>{courses.filter(c => c.learning_track === (selectedItem as Track).id).length}</strong></div><div><span>Статус доступа</span><strong>{(selectedItem as Track).is_active ? 'Активно' : 'Выключено'}</strong></div></>}
            {selected?.kind === 'courses' && <><div><span>Траектория</span><strong>{selectedTrack?.title ?? 'Не назначена'}</strong></div><div><span>Модулей</span><strong>{modules.filter(m => m.course === (selectedItem as Course).id).length}</strong></div></>}
            {selected?.kind === 'modules' && <><div><span>Курс</span><strong>{selectedCourse?.title ?? '—'}</strong></div><div><span>Уроков</span><strong>{lessons.filter(lesson => lesson.module === (selectedItem as Module).id).length}</strong></div></>}
            {selected?.kind === 'lessons' && <><div><span>Модуль</span><strong>{selectedModule?.title ?? '—'}</strong></div><div><span>Порядок</span><strong>{(selectedItem as Lesson).position + 1}</strong></div></>}
          </div>
          <div className="detail-actions">{selected?.kind !== 'tracks' && <Button variant="secondary" onClick={() => start(selected!.kind, selectedItem)}><Pencil size={16}/> Изменить сведения</Button>}
            {selected?.kind === 'tracks' && <Button onClick={() => start('courses', undefined, (selectedItem as Track).id)}><CirclePlus size={16}/> Добавить курс</Button>}
            {selected?.kind === 'courses' && <Button onClick={() => start('modules', undefined, (selectedItem as Course).id)}><CirclePlus size={16}/> Добавить модуль</Button>}
            {selected?.kind === 'modules' && <Button onClick={() => start('lessons', undefined, (selectedItem as Module).id)}><CirclePlus size={16}/> Добавить урок</Button>}
            {selected?.kind === 'lessons' && <><Link className="button primary" to={`/admin/lessons/${selected.id}/edit`}>Редактировать содержание</Link><Link className="button secondary" to={`/admin/lessons/${selected.id}/test`}>Настроить тест</Link></>}
            {selected?.kind !== 'tracks' && <Button variant="danger" className="detail-delete" onClick={() => setRemove(selected)}><Trash2 size={16}/> Удалить</Button>}
          </div>
        </>}
      </div>
    </section>}
    {editing && <div className="modal-backdrop"><div className="modal form-modal"><h2>{editing.item ? 'Изменить' : 'Создать'} {accusativeFor(editing.kind)}</h2><label>Название<Input autoFocus value={String(form.title || '')} onChange={e => setForm(current => ({ ...current, title: e.target.value }))}/></label><label>Описание<Textarea rows={3} value={String(form.description || '')} onChange={e => setForm(current => ({ ...current, description: e.target.value }))}/></label>
      {editing.kind === 'courses' && <><label>Траектория<select className="input" value={Number(form.learning_track)} onChange={e => setForm(current => ({ ...current, learning_track: Number(e.target.value) }))}><option value={0} disabled>Выберите траекторию</option>{tracks.map(track => <option key={track.id} value={track.id}>{track.title}{track.is_active ? '' : ' · отключено'}</option>)}</select></label><label>URL курса<Input value={String(form.slug || '')} placeholder="Создаётся из названия автоматически" onChange={e => setForm(current => ({ ...current, slug: e.target.value }))}/></label></>}
      {editing.kind === 'modules' && <label>Курс<select className="input" value={Number(form.course)} onChange={e => setForm(current => ({ ...current, course: Number(e.target.value) }))}>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>}
      {editing.kind === 'lessons' && <label>Модуль<select className="input" value={Number(form.module)} onChange={e => setForm(current => ({ ...current, module: Number(e.target.value) }))}>{modules.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>}
      {(editing.kind === 'courses' || editing.kind === 'modules' || editing.kind === 'lessons') && <label>Порядок (с нуля)<Input type="number" min="0" value={Number(form.position) || 0} onChange={e => setForm(current => ({ ...current, position: Number(e.target.value) }))}/></label>}
      {editing.kind === 'tracks' && <label className="checkbox"><input type="checkbox" checked={Boolean(form.is_active)} onChange={e => setForm(current => ({ ...current, is_active: e.target.checked }))}/> Доступно для выбора при регистрации</label>}
      {editing.kind === 'lessons' ? <label>Статус<select className="input" value={String(form.status)} onChange={e => setForm(current => ({ ...current, status: e.target.value }))}><option value="DRAFT">Черновик</option><option value="PUBLISHED">Опубликован</option></select></label> : <label className="checkbox"><input type="checkbox" checked={Boolean(form.is_published)} onChange={e => setForm(current => ({ ...current, is_published: e.target.checked }))}/> Опубликовано</label>}
      <div className="row"><Button onClick={save}>Сохранить</Button><Button variant="secondary" onClick={() => setEditing(null)}>Отмена</Button></div></div></div>}
    {remove && <Confirm title={`Удалить ${accusativeFor(remove.kind)}?`} onConfirm={destroy} onCancel={() => setRemove(null)}/>}
  </>
}
