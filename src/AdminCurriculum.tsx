import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, CirclePlus, FileText, Layers3, Pencil, Search, Trash2 } from 'lucide-react'
import { api, type Lesson, type Module, type Page, type Track } from './api'
import { Button, Confirm, ErrorState, Input, Loading, Notice, Textarea } from './App'
import './admin-curriculum.css'

type Kind = 'tracks' | 'modules' | 'lessons'
type Selected = { kind: Kind; id: string }
type ContentItem = Track | Module | Lesson

const isLesson = (item: ContentItem): item is Lesson => 'module' in item && 'status' in item
const isModule = (item: ContentItem): item is Module => 'track' in item
const labelFor = (kind: Kind) => kind === 'tracks' ? 'Траектория' : kind === 'modules' ? 'Модуль' : 'Урок'
const published = (item: ContentItem) => isLesson(item) ? item.status === 'PUBLISHED' : item.is_published
const endpoint = (kind: Kind, id?: string) => `${kind}/${id ? `${id}/` : ''}`

export function AdminCurriculum() {
  const qc = useQueryClient()
  const tracksQuery = useQuery({ queryKey: ['admin', 'tracks'], queryFn: () => api<Page<Track>>('tracks/') })
  const modulesQuery = useQuery({ queryKey: ['admin', 'modules'], queryFn: () => api<Page<Module>>('modules/') })
  const lessonsQuery = useQuery({ queryKey: ['admin', 'lessons'], queryFn: () => api<Page<Lesson>>('lessons/') })
  const [selected, setSelected] = useState<Selected | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ kind: Kind; item?: ContentItem; parentId?: number } | null>(null)
  const [form, setForm] = useState<Record<string, string | number | boolean>>({})
  const [remove, setRemove] = useState<Selected | null>(null)
  const [message, setMessage] = useState('')
  const tracks = tracksQuery.data?.results ?? []
  const modules = modulesQuery.data?.results ?? []
  const lessons = lessonsQuery.data?.results ?? []
  const loading = tracksQuery.isLoading || modulesQuery.isLoading || lessonsQuery.isLoading
  const error = tracksQuery.error || modulesQuery.error || lessonsQuery.error
  const filtered = search.trim().toLocaleLowerCase()
  const visibleTree = useMemo(() => tracks.map(track => {
    const trackModules = modules.filter(module => module.track === track.id).map(module => ({
      module,
      lessons: lessons.filter(lesson => lesson.module === module.id),
    }))
    const matches = (value: string) => !filtered || value.toLocaleLowerCase().includes(filtered)
    const children = trackModules.map(group => ({ ...group, lessons: group.lessons.filter(lesson => matches(lesson.title) || matches(group.module.title) || matches(track.title)) }))
      .filter(group => matches(track.title) || matches(group.module.title) || group.lessons.length > 0)
    return { track, modules: children }
  }).filter(group => !filtered || group.track.title.toLocaleLowerCase().includes(filtered) || group.modules.length > 0), [tracks, modules, lessons, filtered])
  const selectedItem = selected ? ({ tracks, modules, lessons }[selected.kind]).find(item => item.short_id === selected.id) : null
  const parentModule = selectedItem && isLesson(selectedItem) ? modules.find(module => module.id === selectedItem.module) : null
  const parentTrack = selectedItem ? isModule(selectedItem) ? tracks.find(track => track.id === selectedItem.track) : parentModule ? tracks.find(track => track.id === parentModule.track) : null : null
  const start = (kind: Kind, item?: ContentItem, parentId?: number) => {
    setEditing({ kind, item, parentId })
    setForm(item ? { ...item } as unknown as Record<string, string | number | boolean> : {
      title: '', description: '', position: 0, is_published: false, status: 'DRAFT',
      ...(kind === 'modules' ? { track: parentId ?? tracks[0]?.id ?? 0 } : {}),
      ...(kind === 'lessons' ? { module: parentId ?? modules[0]?.id ?? 0 } : {}),
    })
  }
  const save = async () => {
    if (!editing) return
    try {
      const body = { ...form }
      for (const key of ['id', 'short_id', 'created_at', 'updated_at']) delete body[key]
      const id = editing.item?.short_id
      const result = await api<ContentItem>(endpoint(editing.kind, id), id ? 'PATCH' : 'POST', body)
      await Promise.all(['tracks', 'modules', 'lessons'].map(key => qc.invalidateQueries({ queryKey: ['admin', key] })))
      setSelected({ kind: editing.kind, id: result.short_id })
      setEditing(null)
      setMessage(`${labelFor(editing.kind)} сохранён`)
    } catch (e) { setMessage((e as Error).message) }
  }
  const destroy = async () => {
    if (!remove) return
    try {
      await api(endpoint(remove.kind, remove.id), 'DELETE')
      await Promise.all(['tracks', 'modules', 'lessons'].map(key => qc.invalidateQueries({ queryKey: ['admin', key] })))
      setSelected(null); setRemove(null); setMessage(`${labelFor(remove.kind)} удалён`)
    } catch (e) { setRemove(null); setMessage((e as Error).message) }
  }
  const toggle = (key: string) => setExpanded(value => ({ ...value, [key]: !(value[key] ?? true) }))
  const select = (kind: Kind, id: string) => setSelected({ kind, id })

  return <>
    <div className="page-head curriculum-heading"><div><span className="eyebrow">УПРАВЛЕНИЕ КОНТЕНТОМ</span><h1>Учебная программа</h1><p>Траектории, модули и уроки в одном месте.</p></div><Button onClick={() => start('tracks')}><CirclePlus size={17}/> Новая траектория</Button></div>
    <Notice text={message} kind={message && !message.includes('сохранён') && !message.includes('удалён') ? 'error' : 'success'}/>
    {loading ? <Loading/> : error ? <ErrorState error={error}/> : <section className="curriculum-workspace card">
      <aside className="curriculum-tree" aria-label="Структура учебной программы">
        <div className="curriculum-tree-head"><strong>Структура</strong><span>{tracks.length} траекторий</span></div>
        <label className="curriculum-search"><Search size={16}/><input aria-label="Поиск по программе" value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти материал"/></label>
        <div className="tree-scroll">
          {visibleTree.map(({ track, modules: groups }) => {
            const trackKey = `track-${track.id}`, trackOpen = filtered.length > 0 || (expanded[trackKey] ?? true)
            return <div className="tree-group" key={track.id}>
              <div className={`tree-row ${selected?.kind === 'tracks' && selected.id === track.short_id ? 'selected' : ''}`}>
                <button className="tree-toggle" aria-label={trackOpen ? 'Свернуть траекторию' : 'Развернуть траекторию'} onClick={() => toggle(trackKey)}>{trackOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>
                <button className="tree-item" onClick={() => select('tracks', track.short_id)}><Layers3 size={16}/><span>{track.title}</span></button>
                <button className="tree-add" title="Добавить модуль" onClick={() => start('modules', undefined, track.id)}><CirclePlus size={15}/></button>
              </div>
              {trackOpen && groups.map(({ module, lessons: childLessons }) => {
                const moduleKey = `module-${module.id}`, moduleOpen = filtered.length > 0 || (expanded[moduleKey] ?? true)
                return <div className="tree-module" key={module.id}>
                  <div className={`tree-row ${selected?.kind === 'modules' && selected.id === module.short_id ? 'selected' : ''}`}>
                    <button className="tree-toggle" aria-label={moduleOpen ? 'Свернуть модуль' : 'Развернуть модуль'} onClick={() => toggle(moduleKey)}>{moduleOpen ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>
                    <button className="tree-item" onClick={() => select('modules', module.short_id)}><BookOpen size={15}/><span>{module.title}</span></button>
                    <button className="tree-add" title="Добавить урок" onClick={() => start('lessons', undefined, module.id)}><CirclePlus size={15}/></button>
                  </div>
                  {moduleOpen && childLessons.map(lesson => <button key={lesson.id} className={`tree-row tree-lesson ${selected?.kind === 'lessons' && selected.id === lesson.short_id ? 'selected' : ''}`} onClick={() => select('lessons', lesson.short_id)}><span className="tree-spacer"/><FileText size={15}/><span className="tree-label">{lesson.title}</span></button>)}
                </div>
              })}
              {trackOpen && groups.length === 0 && <div className="tree-empty">Пока нет модулей</div>}
            </div>
          })}
          {visibleTree.length === 0 && <div className="tree-empty">Ничего не найдено</div>}
        </div>
      </aside>
      <div className="curriculum-detail">
        {!selectedItem ? <div className="curriculum-welcome"><div className="curriculum-welcome-icon"><Layers3 size={25}/></div><h2>Выберите материал</h2><p>Откройте траекторию, модуль или урок в списке слева, чтобы посмотреть сведения и действия.</p><Button variant="secondary" onClick={() => start('tracks')}><CirclePlus size={16}/> Создать траекторию</Button></div> : <>
          <div className="detail-top"><div><span className="eyebrow">{labelFor(selected!.kind).toLocaleUpperCase()}</span><h2>{selectedItem.title}</h2></div><span className={`status ${published(selectedItem) ? 'published' : ''}`}>{published(selectedItem) ? 'Опубликовано' : 'Черновик'}</span></div>
          <div className="curriculum-breadcrumb">{parentTrack && <><span>{parentTrack.title}</span><span>›</span></>}{parentModule && selected?.kind === 'lessons' && <><span>{parentModule.title}</span><span>›</span></>}<strong>{selectedItem.title}</strong></div>
          <p className="detail-description">{selectedItem.description || 'Описание пока не добавлено.'}</p>
          <div className="detail-facts">
            {selected?.kind === 'tracks' && <><div><span>Модулей</span><strong>{modules.filter(item => item.track === (selectedItem as Track).id).length}</strong></div><div><span>Уроков</span><strong>{lessons.filter(lesson => modules.some(module => module.track === (selectedItem as Track).id && module.id === lesson.module)).length}</strong></div></>}
            {selected?.kind === 'modules' && <><div><span>Траектория</span><strong>{parentTrack?.title ?? '—'}</strong></div><div><span>Уроков</span><strong>{lessons.filter(lesson => lesson.module === (selectedItem as Module).id).length}</strong></div></>}
            {selected?.kind === 'lessons' && <><div><span>Модуль</span><strong>{parentModule?.title ?? '—'}</strong></div><div><span>Порядок</span><strong>{(selectedItem as Lesson).position + 1}</strong></div></>}
          </div>
          <div className="detail-actions"><Button variant="secondary" onClick={() => start(selected!.kind, selectedItem)}><Pencil size={16}/> Изменить сведения</Button>
            {selected?.kind === 'tracks' && <Button onClick={() => start('modules', undefined, (selectedItem as Track).id)}><CirclePlus size={16}/> Добавить модуль</Button>}
            {selected?.kind === 'modules' && <Button onClick={() => start('lessons', undefined, (selectedItem as Module).id)}><CirclePlus size={16}/> Добавить урок</Button>}
            {selected?.kind === 'lessons' && <><Link className="button primary" to={`/admin/lessons/${selected.id}/edit`}>Редактировать содержание</Link><Link className="button secondary" to={`/admin/lessons/${selected.id}/test`}>Настроить тест</Link></>}
            <Button variant="danger" className="detail-delete" onClick={() => setRemove(selected)}><Trash2 size={16}/> Удалить</Button>
          </div>
        </>}
      </div>
    </section>}
    {editing && <div className="modal-backdrop"><div className="modal form-modal"><h2>{editing.item ? 'Изменить' : 'Создать'} {labelFor(editing.kind).toLocaleLowerCase()}</h2><label>Название<Input autoFocus value={String(form.title || '')} onChange={e => setForm(current => ({ ...current, title: e.target.value }))}/></label><label>Описание<Textarea rows={3} value={String(form.description || '')} onChange={e => setForm(current => ({ ...current, description: e.target.value }))}/></label>
      {editing.kind === 'modules' && <label>Траектория<select className="input" value={Number(form.track)} onChange={e => setForm(current => ({ ...current, track: Number(e.target.value) }))}>{tracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select></label>}
      {editing.kind === 'lessons' && <label>Модуль<select className="input" value={Number(form.module)} onChange={e => setForm(current => ({ ...current, module: Number(e.target.value) }))}>{modules.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>}
      {editing.kind !== 'tracks' && <label>Порядок (с нуля)<Input type="number" min="0" value={Number(form.position) || 0} onChange={e => setForm(current => ({ ...current, position: Number(e.target.value) }))}/></label>}
      {editing.kind === 'lessons' ? <label>Статус<select className="input" value={String(form.status)} onChange={e => setForm(current => ({ ...current, status: e.target.value }))}><option value="DRAFT">Черновик</option><option value="PUBLISHED">Опубликован</option></select></label> : <label className="checkbox"><input type="checkbox" checked={Boolean(form.is_published)} onChange={e => setForm(current => ({ ...current, is_published: e.target.checked }))}/> Опубликовано</label>}
      <div className="row"><Button onClick={save}>Сохранить</Button><Button variant="secondary" onClick={() => setEditing(null)}>Отмена</Button></div></div></div>}
    {remove && <Confirm title={`Удалить ${labelFor(remove.kind).toLocaleLowerCase()}?`} onConfirm={destroy} onCancel={() => setRemove(null)}/>}
  </>
}
