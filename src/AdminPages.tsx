import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Eye, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { api, apiAll, ApiError, type Block, type Lesson, type Module, type Question, type Test, type Track } from './api'
import { Button, Confirm, ErrorState, Input, Loading, Notice, Textarea } from './components/ui'
import { EditorLayout, type SaveState } from './layouts/EditorLayout'

type Kind = 'tracks' | 'modules' | 'lessons'
type Item = Track | Module | Lesson
export function AdminList({ kind }: { kind: Kind }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', kind], queryFn: () => apiAll<Item>(`${kind}/`) })
  const tracks = useQuery({ queryKey: ['admin', 'tracks'], queryFn: () => apiAll<Track>('tracks/'), enabled: kind !== 'tracks' })
  const modules = useQuery({ queryKey: ['admin', 'modules'], queryFn: () => apiAll<Module>('modules/'), enabled: kind === 'lessons' })
  const [editing, setEditing] = useState<Item | null | 'new'>(null)
  const [form, setForm] = useState<Record<string, string | number | boolean>>({})
  const [message, setMessage] = useState(''), [remove, setRemove] = useState<string | null>(null)
  const label = kind === 'tracks' ? 'траектории' : kind === 'modules' ? 'модули' : 'уроки'
  const start = (item?: Item) => { setEditing(item || 'new'); setForm(item ? { ...item } as unknown as Record<string, string | number | boolean> : { title: '', description: '', position: 0, track: tracks.data?.[0]?.id || 0, module: modules.data?.[0]?.id || 0, is_published: false, status: 'DRAFT' }) }
  const field = (key: string, value: string | number | boolean) => setForm(f => ({ ...f, [key]: value }))
  const save = async () => {
    try {
      const body = { ...form }; delete body.id; delete body.short_id; delete body.created_at; delete body.updated_at
      const id = editing && editing !== 'new' ? editing.short_id : null
      await api(`${kind}/${id ? id + '/' : ''}`, id ? 'PATCH' : 'POST', body)
      await qc.invalidateQueries({ queryKey: ['admin', kind] })
      setEditing(null); setMessage('Сохранено')
    } catch (e) { setMessage((e as Error).message) }
  }
  const destroy = async () => { if (!remove) return; try { await api(`${kind}/${remove}/`, 'DELETE'); await qc.invalidateQueries({ queryKey: ['admin', kind] }); setRemove(null); setMessage('Удалено') } catch (e) { setMessage((e as Error).message); setRemove(null) } }
  return <><div className="page-head"><div><span className="eyebrow">УПРАВЛЕНИЕ КОНТЕНТОМ</span><h1>{label[0].toUpperCase() + label.slice(1)}</h1><p>Создавайте и публикуйте материалы для студентов.</p></div><Button onClick={() => start()}><Plus size={17}/> Добавить</Button></div><Notice text={message} kind={message.includes('Ошибка') || message.includes('{') ? 'error' : 'success'}/>{isLoading ? <Loading/> : error ? <ErrorState error={error}/> : <div className="card table-wrap"><table><thead><tr><th>Название</th><th>Статус</th><th>Порядок</th><th>Действия</th></tr></thead><tbody>{data?.map(item => <tr key={item.id}><td><strong>{item.title}</strong><small>{item.description}</small></td><td><span className={`status ${'status' in item ? item.status === 'PUBLISHED' ? 'published' : '' : item.is_published ? 'published' : ''}`}>{'status' in item ? item.status === 'PUBLISHED' ? 'Опубликован' : 'Черновик' : item.is_published ? 'Опубликован' : 'Черновик'}</span></td><td>{'position' in item ? item.position + 1 : '—'}</td><td><div className="actions"><button onClick={() => start(item)}>Изменить</button>{kind === 'lessons' && <><Link to={`/admin/lessons/${item.short_id}/edit`}>Конструктор</Link><Link to={`/admin/lessons/${item.short_id}/test`}>Тест</Link></>}<button className="danger-text" onClick={() => setRemove(item.short_id)}>Удалить</button></div></td></tr>)}</tbody></table>{!data?.length && <div className="empty">Пока нет материалов. Создайте первый элемент.</div>}</div>}
  {editing && <div className="modal-backdrop"><div className="modal form-modal"><h2>{editing === 'new' ? 'Создать' : 'Редактировать'} {kind === 'tracks' ? 'траекторию' : kind === 'modules' ? 'модуль' : 'урок'}</h2><label>Название<Input value={String(form.title || '')} onChange={e => field('title', e.target.value)}/></label><label>Описание<Textarea rows={3} value={String(form.description || '')} onChange={e => field('description', e.target.value)}/></label>{kind === 'modules' && <label>Траектория<select className="input" value={Number(form.track)} onChange={e => field('track', Number(e.target.value))}>{tracks.data?.map(t => <option value={t.id} key={t.id}>{t.title}</option>)}</select></label>}{kind === 'lessons' && <label>Модуль<select className="input" value={Number(form.module)} onChange={e => field('module', Number(e.target.value))}>{modules.data?.map(m => <option value={m.id} key={m.id}>{m.title}</option>)}</select></label>}{kind !== 'tracks' && <label>Порядок (с нуля)<Input type="number" min="0" value={Number(form.position) || 0} onChange={e => field('position', Number(e.target.value))}/></label>}{kind === 'lessons' ? <label className="checkbox"><input type="checkbox" checked={form.status === 'PUBLISHED'} onChange={e => field('status', e.target.checked ? 'PUBLISHED' : 'DRAFT')}/> Опубликован</label> : <label className="checkbox"><input type="checkbox" checked={Boolean(form.is_published)} onChange={e => field('is_published', e.target.checked)}/> Опубликовано</label>}<div className="row"><Button onClick={save}>Сохранить</Button><Button variant="secondary" onClick={() => setEditing(null)}>Отмена</Button></div></div></div>}{remove && <Confirm title="Удалить материал?" onConfirm={destroy} onCancel={() => setRemove(null)}/>}</>
}

function useLeaveWarning(dirty: boolean) {
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler) }, [dirty])
  useEffect(() => {
    if (!dirty) return
    const handler = () => { if (!window.confirm('Несохранённые изменения будут потеряны. Продолжить?')) window.history.forward() }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [dirty])
  useEffect(() => {
    if (!dirty) return
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (anchor && anchor.origin === window.location.origin && anchor.pathname !== window.location.pathname && !window.confirm('Несохранённые изменения будут потеряны. Продолжить?')) {
        event.preventDefault(); event.stopPropagation()
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [dirty])
}
function isDesktopViewport() {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 900px)').matches : window.innerWidth >= 900
}
export function EditorPage() {
  const { id } = useParams(), qc = useQueryClient(), navigate = useNavigate()
  const lesson = useQuery({ queryKey: ['admin-lesson', id], queryFn: () => api<Lesson>(`lessons/${id}/`) })
  const saved = useQuery({ queryKey: ['admin-blocks', id], queryFn: () => api<Block[]>(`lessons/${id}/blocks/`) })
  const [blocks, setBlocks] = useState<Block[]>([]), [dirty, setDirty] = useState(false), [preview, setPreview] = useState(false), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0)
  const [settingsOpen, setSettingsOpen] = useState(isDesktopViewport)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [insertMenuIndex, setInsertMenuIndex] = useState<number | null>(null)
  useEffect(() => { if (saved.data && !dirty) { setBlocks(saved.data); setSelectedIndex(saved.data.length ? 0 : null) } }, [saved.data, dirty])
  useLeaveWarning(dirty)
  const markChanged = (next: Block[]) => { setBlocks(next.map((block, index) => ({ ...block, position: index }))); setDirty(true); setSaveState('dirty'); setMessage('') }
  const select = (index: number) => { setSelectedIndex(index); if (!isDesktopViewport()) setSettingsOpen(true) }
  const move = (i: number, delta: number) => { const next = [...blocks], j = i + delta; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; markChanged(next); setSelectedIndex(j) }
  const insert = (index: number, type: Block['type']) => {
    const block: Block = { type, position: index, content: '', media: null, config: {} }
    const next = [...blocks]; next.splice(index, 0, block); markChanged(next); setSelectedIndex(index)
    setInsertMenuIndex(null)
    if (!isDesktopViewport()) setSettingsOpen(true)
  }
  const updateSelected = (changes: Partial<Block>) => {
    if (selectedIndex === null) return
    markChanged(blocks.map((block, index) => index === selectedIndex ? { ...block, ...changes } : block))
  }
  const upload = async (file: File) => {
    if (selectedIndex === null) return
    const index = selectedIndex
    const data = new FormData(); data.append('file', file); setUploading(true); setSaveState('saving'); setMessage('')
    try {
      const result = await api<{id: number; url: string}>('media/', 'POST', data)
      setBlocks(previous => previous.map((block, current) => current === index ? { ...block, media: result.id, media_url: result.url } : block))
      setDirty(true); setSaveState('dirty')
    } catch (error) { setSaveState('error'); setMessage(error instanceof Error ? error.message : 'Не удалось загрузить изображение') }
    finally { setUploading(false) }
  }
  const save = async (publish = false) => {
    if (uploading || busy) return
    setBusy(true); setSaveState('saving'); setMessage('')
    try {
      const result = await api<Block[]>(`lessons/${id}/blocks/`, 'PUT', blocks.map(({ type, position, content, media, config }) => ({ type, position, content, media, config })))
      if (publish) await api(`lessons/${id}/`, 'PATCH', { status: 'PUBLISHED' })
      qc.setQueryData(['admin-blocks', id], result); setBlocks(result); setDirty(false); setSaveState('saved'); setMessage(publish ? 'Урок опубликован' : 'Изменения сохранены'); qc.invalidateQueries({ queryKey: ['admin-lesson', id] })
    } catch (error) { setSaveState('error'); setMessage(error instanceof Error ? error.message : 'Не удалось сохранить урок') }
    finally { setBusy(false) }
  }
  if (lesson.isLoading || saved.isLoading) return <Loading/>
  if (lesson.error || saved.error) return <ErrorState error={lesson.error || saved.error}/>
  const activeBlock = selectedIndex === null ? undefined : blocks[selectedIndex]
  const editorActions = <><Button variant="secondary" onClick={() => setPreview(value => !value)}><Eye size={16}/>{preview ? 'Редактировать' : 'Предпросмотр'}</Button><Button variant="secondary" disabled={busy || uploading} onClick={() => save()}><Save size={16}/>Сохранить</Button><Button disabled={busy || uploading} onClick={() => save(true)}>Опубликовать</Button></>
  return <EditorLayout title={lesson.data?.title || 'Конструктор урока'} status={lesson.data?.status || 'DRAFT'} saveState={uploading ? 'saving' : saveState} actions={editorActions}>
    <div className={`editor-page-tools ${settingsOpen ? '' : 'settings-collapsed'}`}><div><span className="eyebrow">КОНСТРУКТОР УРОКА</span><p>Соберите лекцию из текстовых блоков и изображений.</p></div><div className="editor-tool-links"><Button variant="secondary" onClick={() => { if (!dirty || window.confirm('Несохранённые изменения будут потеряны. Продолжить?')) navigate(`/admin/lessons/${id}/test`) }}>Конструктор теста</Button><Button variant="secondary" className="settings-trigger" onClick={() => setSettingsOpen(true)}>Настройки блока</Button></div></div>
    {message && <Notice text={message} kind={saveState === 'error' ? 'error' : 'success'}/>}
    {preview ? <article className="article card editor-preview">{blocks.map((block, index) => block.type === 'TEXT' ? <div className="markdown" key={block.id ?? index}><ReactMarkdown skipHtml>{block.content}</ReactMarkdown></div> : <figure key={block.id ?? index}>{block.media_url && <img src={block.media_url} alt={block.content || 'Изображение урока'}/>}<figcaption>{block.content}</figcaption></figure>)}</article> : <div className={`editor-workspace ${settingsOpen ? 'settings-open' : 'settings-closed'}`}>
      <section className="editor-canvas" aria-label="Блоки урока">
        <div className="editor-canvas-heading"><div><strong>Содержание урока</strong><span>{blocks.length} {blocks.length === 1 ? 'блок' : 'блоков'}</span></div><span className="save-state compact"><i/> {dirty ? 'Есть изменения' : saveState === 'saved' ? 'Сохранено' : 'Готово к редактированию'}</span></div>
        {blocks.length === 0 && <div className="editor-empty"><span className="quick-link-icon"><BookOpen size={22}/></span><h2>Начните собирать урок</h2><p>Добавьте первый текстовый блок или изображение. Настройки появятся справа.</p></div>}
        {blocks.map((block, index) => <div className="editor-block-wrap" key={block.id ?? `new-${index}`}>
          <article className={`editor-block-card ${selectedIndex === index ? 'selected' : ''}`}>
            <button className="editor-block-select" aria-pressed={selectedIndex === index} onClick={() => select(index)}><span className="block-type-label">{block.type === 'TEXT' ? 'ТЕКСТОВЫЙ БЛОК' : 'ИЗОБРАЖЕНИЕ'} <span>· {String(index + 1).padStart(2, '0')}</span></span>{block.type === 'TEXT' ? <span className="block-text-preview">{block.content || 'Нажмите, чтобы добавить текст…'}</span> : block.media_url ? <img className="block-image-preview" src={block.media_url} alt={block.content || 'Предпросмотр изображения'}/> : <span className="block-image-empty"><ImagePlus size={20}/>Изображение ещё не загружено</span>}</button>
            <div className="block-actions"><button title="Переместить вверх" aria-label="Переместить вверх" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button title="Переместить вниз" aria-label="Переместить вниз" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button title="Удалить блок" aria-label="Удалить блок" onClick={() => { const next = blocks.filter((_, itemIndex) => itemIndex !== index); markChanged(next); setSelectedIndex(next.length ? Math.min(index, next.length - 1) : null) }}><Trash2 size={16}/></button></div>
          </article>
          <div className="add-between-wrap"><button className="add-between" onClick={() => setInsertMenuIndex(current => current === index + 1 ? null : index + 1)} aria-expanded={insertMenuIndex === index + 1} aria-label={`Добавить блок после блока ${index + 1}`}><span>+</span>Добавить блок</button>{insertMenuIndex === index + 1 && <div className="add-between-menu"><button onClick={() => insert(index + 1, 'TEXT')}><BookOpen size={15}/>Текст</button><button onClick={() => insert(index + 1, 'IMAGE')}><ImagePlus size={15}/>Изображение</button></div>}</div>
        </div>)}
        <div className="editor-add-actions"><Button variant="secondary" onClick={() => insert(blocks.length, 'TEXT')}><Plus size={16}/>Текстовый блок</Button><Button variant="secondary" onClick={() => insert(blocks.length, 'IMAGE')}><ImagePlus size={16}/>Изображение</Button></div>
      </section>
      {settingsOpen && !isDesktopViewport() && <div className="settings-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !isDesktopViewport()) setSettingsOpen(false) }}/>}
      <aside className={`block-settings ${settingsOpen ? 'open' : ''}`} aria-label="Настройки выбранного блока">
        <div className="block-settings-header"><div><span className="eyebrow">НАСТРОЙКИ</span><h2>{activeBlock ? activeBlock.type === 'TEXT' ? 'Текстовый блок' : 'Изображение' : 'Блок не выбран'}</h2></div><button className="icon-button settings-close" aria-label="Скрыть настройки" onClick={() => setSettingsOpen(false)}>×</button></div>
        {activeBlock && selectedIndex !== null ? activeBlock.type === 'TEXT' ? <div className="settings-fields"><label>Текст урока<Textarea rows={18} value={activeBlock.content} placeholder="Пишите в Markdown: заголовки, списки, выделения…" onChange={event => updateSelected({ content: event.target.value })}/></label><p className="settings-help">Поддерживаются заголовки, списки, ссылки и выделение текста.</p><Button variant="secondary" onClick={() => setPreview(true)}><Eye size={16}/>Предпросмотр лекции</Button></div> : <div className="settings-fields"><label className="upload settings-upload"><ImagePlus size={20}/>{activeBlock.media_url ? 'Заменить изображение' : 'Загрузить изображение'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }}/></label>{activeBlock.media_url && <img className="settings-image-preview" src={activeBlock.media_url} alt="Предпросмотр загруженного изображения"/>}<label>Подпись<Input value={activeBlock.content} placeholder="Кратко опишите изображение" onChange={event => updateSelected({ content: event.target.value })}/></label><p className="settings-help">Изображения JPEG, PNG и WebP. Подпись также используется для доступного описания.</p></div> : <p className="settings-help">Выберите блок в рабочей области, чтобы изменить его содержимое.</p>}
      </aside>
    </div>}
  </EditorLayout>
}

const freshQuestion = (position: number): Question => ({ text: '', position, points: 1, options: [{ text: '', position: 0, is_correct: true }, { text: '', position: 1, is_correct: false }] })
export function TestEditor() {
  const { id } = useParams(), navigate = useNavigate(), qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-test', id], queryFn: () => api<Test>(`lessons/${id}/test/`).catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e }) })
  const [test, setTest] = useState<Test>({ title: '', description: '', passing_percent: 70, max_attempts: null, is_published: false, questions: [] })
  const [dirty, setDirty] = useState(false), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [saveState, setSaveState] = useState<SaveState>('saved')
  useEffect(() => { if (data && !dirty) setTest(data) }, [data, dirty])
  useLeaveWarning(dirty)
  const set = (next: Test) => { setTest(next); setDirty(true); setSaveState('dirty') }
  const updateQ = (i: number, q: Question) => set({ ...test, questions: test.questions.map((item, j) => j === i ? q : item) })
  const move = (i: number, delta: number) => { const next = [...test.questions], j = i + delta; if (j < 0 || j >= next.length) return; [next[i], next[j]] = [next[j], next[i]]; set({ ...test, questions: next.map((q, idx) => ({ ...q, position: idx })) }) }
  const save = async (publish: boolean) => { setBusy(true); setSaveState('saving'); setMessage(''); try { const result = await api<Test>(`lessons/${id}/test/`, 'PUT', { ...test, is_published: publish, questions: test.questions.map((q, i) => ({ ...q, position: i, options: q.options.map((o, j) => ({ ...o, position: j })) })) }); qc.setQueryData(['admin-test', id], result); setTest(result); setDirty(false); setSaveState('saved'); setMessage(publish ? 'Тест опубликован' : 'Черновик теста сохранён') } catch (e) { setSaveState('error'); setMessage((e as Error).message) } finally { setBusy(false) } }
  if (isLoading) return <Loading/>
  const testActions = <><Button variant="secondary" disabled={busy} onClick={() => save(false)}>Сохранить черновик</Button><Button disabled={busy} onClick={() => save(true)}>Опубликовать тест</Button></>
  return <EditorLayout title={test.title || 'Конструктор теста'} status={test.is_published ? 'PUBLISHED' : 'DRAFT'} saveState={saveState} actions={testActions}><div className="test-editor-page"><button className="back" onClick={() => { if (!dirty || window.confirm('Несохранённые изменения будут потеряны. Продолжить?')) navigate(`/admin/lessons/${id}/edit`) }}><ArrowLeft size={16}/> К уроку</button><div className="page-heading-row"><div><span className="eyebrow">КОНСТРУКТОР ТЕСТА</span><h1>Проверка знаний</h1><p>Создайте вопросы с одним правильным ответом.</p></div></div><div className="card form-card"><label>Название теста<Input value={test.title} onChange={e => set({ ...test, title: e.target.value })}/></label><label>Описание<Textarea rows={2} value={test.description} onChange={e => set({ ...test, description: e.target.value })}/></label><div className="row"><label>Проходной балл, %<Input type="number" min="0" max="100" value={test.passing_percent} onChange={e => set({ ...test, passing_percent: Number(e.target.value) })}/></label><label>Лимит попыток (пусто — без лимита)<Input type="number" min="1" value={test.max_attempts ?? ''} onChange={e => set({ ...test, max_attempts: e.target.value ? Number(e.target.value) : null })}/></label></div></div><div className="stack editor-blocks">{test.questions.map((q, i) => <div className="card question-editor" key={i}><div className="block-top"><span className="eyebrow">ВОПРОС {i + 1}</span><div className="icon-actions"><button disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={17}/></button><button disabled={i === test.questions.length - 1} onClick={() => move(i, 1)}><ArrowDown size={17}/></button><button onClick={() => set({ ...test, questions: test.questions.filter((_, j) => j !== i).map((item, j) => ({ ...item, position: j })) })}><Trash2 size={17}/></button></div></div><label>Текст вопроса<Input value={q.text} onChange={e => updateQ(i, { ...q, text: e.target.value })}/></label><label>Баллы<Input type="number" min="1" value={q.points} onChange={e => updateQ(i, { ...q, points: Number(e.target.value) })}/></label><div className="option-editor">{q.options.map((o, j) => <div className="row" key={j}><input aria-label="Правильный ответ" type="radio" name={`correct-${i}`} checked={o.is_correct || false} onChange={() => updateQ(i, { ...q, options: q.options.map((opt, k) => ({ ...opt, is_correct: j === k })) })}/><Input value={o.text} placeholder={`Вариант ${j + 1}`} onChange={e => updateQ(i, { ...q, options: q.options.map((opt, k) => k === j ? { ...opt, text: e.target.value } : opt) })}/><button disabled={q.options.length <= 2} onClick={() => updateQ(i, { ...q, options: q.options.filter((_, k) => k !== j).map((opt, k) => ({ ...opt, position: k })) })}><Trash2 size={16}/></button></div>)}</div><Button variant="secondary" onClick={() => updateQ(i, { ...q, options: [...q.options, { text: '', position: q.options.length, is_correct: false }] })}><Plus size={16}/> Вариант</Button></div>)}</div><div className="add-block"><Button variant="secondary" onClick={() => set({ ...test, questions: [...test.questions, freshQuestion(test.questions.length)] })}><Plus size={17}/> Добавить вопрос</Button></div><Notice text={message} kind={saveState === 'error' ? 'error' : 'success'}/></div></EditorLayout>
}
