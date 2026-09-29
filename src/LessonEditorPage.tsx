import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Copy, Eye, ImagePlus, MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react'
import { api, type Block, type Lesson } from './api'
import { Button, ErrorState, Loading, Notice } from './components/ui'
import { LessonTextEditor, parseLessonContent, RichLessonContent } from './components/LessonTextEditor'
import { EditorLayout, type SaveState } from './layouts/EditorLayout'
import { useLeaveWarning } from './useLeaveWarning'
import './lesson-editor.css'

type Draft = { title: string; description: string; blocks: Block[] }
const normalize = (blocks: Block[]) => blocks.map((block, position) => ({ ...block, position }))
const blankDraft: Draft = { title: '', description: '', blocks: [] }

export function EditorPage() {
  const { id = '' } = useParams(), qc = useQueryClient(), navigate = useNavigate()
  const lessonQuery = useQuery({ queryKey: ['admin-lesson', id], queryFn: () => api<Lesson>(`lessons/${id}/`) })
  const draftQuery = useQuery({ queryKey: ['admin-draft', id], queryFn: () => api<Draft>(`lessons/${id}/draft/`) })
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() => window.innerWidth > 900)
  const [preview, setPreview] = useState(false)
  const [menuIndex, setMenuIndex] = useState<number | null>(null)
  const draftRef = useRef(draft), dirtyRef = useRef(false), requestRef = useRef<Promise<void> | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0)
  const [section, setSection] = useState<'settings' | 'test' | 'practice'>('settings')
  const status = lessonQuery.data?.status ?? 'DRAFT'

  useEffect(() => {
    if (!draftQuery.data || dirtyRef.current) return
    const next = { ...draftQuery.data, blocks: normalize(draftQuery.data.blocks ?? []) }
    setDraft(next); draftRef.current = next; setSelectedIndex(next.blocks.length ? 0 : null)
  }, [draftQuery.data])
  useLeaveWarning(dirty)

  const updateDraft = (next: Draft) => {
    const normalized = { ...next, blocks: normalize(next.blocks) }
    draftRef.current = normalized; dirtyRef.current = true
    setDraft(normalized); setDirty(true); setSaveState('dirty'); setNotice('')
  }
  const persistLatest = useCallback(async (): Promise<void> => {
    if (requestRef.current) { await requestRef.current; if (dirtyRef.current) return persistLatestRef.current() }
    if (!dirtyRef.current) return
    const snapshot = draftRef.current
    setSaveState('saving')
    const task = api<Draft>(`lessons/${id}/draft/`, 'PUT', snapshot).then(saved => {
      qc.setQueryData(['admin-draft', id], saved)
      if (JSON.stringify(draftRef.current) === JSON.stringify(snapshot)) {
        dirtyRef.current = false; setDirty(false); setSaveState('saved')
      }
    }).catch(error => { setSaveState('error'); setNotice(error instanceof Error ? error.message : 'Не удалось сохранить черновик') }).finally(() => { requestRef.current = null })
    requestRef.current = task
    await task
  }, [id, qc])
  const persistLatestRef = useRef<() => Promise<void>>(persistLatest)
  persistLatestRef.current = persistLatest
  useEffect(() => {
    if (!dirty || uploading) return
    const timer = window.setTimeout(() => { void persistLatest() }, 800)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, uploading, persistLatest])

  const changeBlocks = (blocks: Block[]) => updateDraft({ ...draftRef.current, blocks })
  const insert = (index: number, type: Block['type']) => {
    const block: Block = { type, position: index, content: type === 'TEXT' ? JSON.stringify(parseLessonContent('')) : '', media: null, config: {} }
    const blocks = [...draftRef.current.blocks]; blocks.splice(index, 0, block); changeBlocks(blocks); setSelectedIndex(index); setMenuIndex(null)
    if (window.innerWidth <= 900) setSettingsOpen(true)
  }
  const updateBlock = (index: number, patch: Partial<Block>) => changeBlocks(draftRef.current.blocks.map((block, at) => at === index ? { ...block, ...patch } : block))
  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= draftRef.current.blocks.length) return
    const blocks = [...draftRef.current.blocks]; const [block] = blocks.splice(from, 1); if (block) blocks.splice(to, 0, block)
    changeBlocks(blocks); setSelectedIndex(to)
  }
  const duplicateBlock = (index: number) => { const blocks = [...draftRef.current.blocks]; const copy = { ...blocks[index]!, id: undefined, config: { ...blocks[index]!.config } }; blocks.splice(index + 1, 0, copy); changeBlocks(blocks); setSelectedIndex(index + 1); setMenuIndex(null) }
  const upload = async (index: number, file: File) => {
    setUploading(true)
    const form = new FormData(); form.append('file', file)
    try {
      const media = await api<{ id: number; url: string }>('media/', 'POST', form)
      updateBlock(index, { media: media.id, media_url: media.url })
    } catch (error) { setSaveState('error'); setNotice(error instanceof Error ? error.message : 'Не удалось загрузить изображение') }
    finally { setUploading(false) }
  }
  const saveDraft = async () => { setBusy(true); setNotice(''); try { await persistLatest(); if (dirtyRef.current) throw new Error('Черновик не сохранён. Проверьте подключение и повторите попытку.'); setNotice('Черновик сохранён') } catch (error) { setSaveState('error'); setNotice(error instanceof Error ? error.message : 'Не удалось сохранить черновик') } finally { setBusy(false) } }
  const publish = async () => {
    setBusy(true); setNotice('')
    try {
      await persistLatest()
      if (dirtyRef.current) throw new Error('Сначала устраните ошибку сохранения черновика.')
      await api(`lessons/${id}/draft/`, 'POST')
      await qc.invalidateQueries({ queryKey: ['admin-lesson', id] }); await qc.invalidateQueries({ queryKey: ['admin-draft', id] })
      setNotice('Урок опубликован')
    } catch (error) { setSaveState('error'); setNotice(error instanceof Error ? error.message : 'Не удалось опубликовать урок') }
    finally { setBusy(false) }
  }
  const lesson = lessonQuery.data
  if (lessonQuery.isLoading || draftQuery.isLoading) return <Loading/>
  if (lessonQuery.error || draftQuery.error) return <ErrorState error={lessonQuery.error || draftQuery.error}/>
  const selected = selectedIndex === null ? null : draft.blocks[selectedIndex] ?? null
  const editorActions = <><Button variant="secondary" onClick={() => setPreview(value => !value)}><Eye size={16}/>{preview ? 'Редактор' : 'Предпросмотр'}</Button><Button variant="secondary" disabled={busy || uploading || !dirty} onClick={() => void saveDraft()}>Сохранить</Button><Button disabled={busy || uploading} onClick={() => void publish()}>{status === 'PUBLISHED' ? 'Опубликовать изменения' : 'Опубликовать'}</Button></>
  return <EditorLayout title={draft.title || 'Новый урок'} status={status} saveState={uploading ? 'saving' : saveState} actions={editorActions}>
    <div className={`lesson-editor-shell ${settingsOpen ? 'with-settings' : ''}`}>
      <div className="lesson-editor-topline">
        <Link to="/admin/curriculum" className="lesson-back"><ArrowLeft size={17}/> Структура курса</Link>
        <span className="lesson-save-note">{saveState === 'saving' ? 'Сохраняем черновик…' : saveState === 'error' ? 'Ошибка сохранения' : dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}</span>
        <button className="lesson-settings-toggle" onClick={() => setSettingsOpen(value => !value)}><Settings2 size={16}/>{settingsOpen ? 'Скрыть панель' : 'Настройки'}</button>
      </div>
      {notice && <Notice text={notice} kind={saveState === 'error' ? 'error' : 'success'}/>}
      {preview ? <article className="lesson-document lesson-preview"><h1>{draft.title}</h1>{draft.description && <p className="lesson-summary">{draft.description}</p>}{draft.blocks.map((block, index) => <BlockPreview key={block.id ?? index} block={block}/>)}</article> : <>
        <div className="lesson-document-heading"><input aria-label="Название урока" value={draft.title} placeholder="Название урока" maxLength={200} onChange={event => updateDraft({ ...draft, title: event.target.value })}/><textarea aria-label="Описание урока" value={draft.description} placeholder="Краткое описание урока" rows={2} onChange={event => updateDraft({ ...draft, description: event.target.value })}/></div>
        <section className="lesson-document" aria-label="Содержание лекции">
          <div className="document-section-label"><BookOpen size={16}/> Лекция <span>{draft.blocks.length} блоков</span></div>
          {draft.blocks.length === 0 && <div className="lesson-empty"><h2>Начните с чистого листа</h2><p>Добавьте текст или изображение. Содержание увидит студент после публикации.</p></div>}
          {draft.blocks.map((block, index) => <div key={block.id ?? `draft-${index}`} className="document-block" draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) moveBlock(from, index) }}>
            <div className="document-block-tools"><span>{block.type === 'TEXT' ? 'ТЕКСТ' : 'ИЗОБРАЖЕНИЕ'} · {String(index + 1).padStart(2, '0')}</span><button aria-label="Действия блока" onClick={() => setMenuIndex(menuIndex === index ? null : index)}><MoreHorizontal size={18}/></button>
              {menuIndex === index && <div className="block-context-menu"><button disabled={index === 0} onClick={() => { moveBlock(index, index - 1); setMenuIndex(null) }}><ArrowUp size={15}/> Выше</button><button disabled={index === draft.blocks.length - 1} onClick={() => { moveBlock(index, index + 1); setMenuIndex(null) }}><ArrowDown size={15}/> Ниже</button><button onClick={() => duplicateBlock(index)}><Copy size={15}/> Дублировать</button><button onClick={() => insert(index + 1, block.type)}><Plus size={15}/> Добавить после</button><button className="danger-action" onClick={() => { const blocks = draftRef.current.blocks.filter((_, at) => at !== index); changeBlocks(blocks); setSelectedIndex(blocks.length ? Math.min(index, blocks.length - 1) : null); setMenuIndex(null) }}><Trash2 size={15}/> Удалить</button></div>}
            </div>
            {block.type === 'TEXT' ? <div className={selectedIndex === index ? 'selected-document-block' : ''} onFocus={() => setSelectedIndex(index)}><LessonTextEditor value={block.content} onChange={content => updateBlock(index, { content })}/></div> : <figure className={`document-image-block ${block.config.width === 'reading' ? 'reading-width' : ''}`} onClick={() => setSelectedIndex(index)}>{block.media_url ? <img src={block.media_url} alt={block.content || 'Предпросмотр изображения'}/>: <label className="image-dropzone"><ImagePlus size={24}/> Загрузите изображение<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(index, file); event.currentTarget.value = '' }}/></label>}{block.media_url && block.content && <figcaption>{block.content}</figcaption>}</figure>}
            <div className="insert-between"><button onClick={() => insert(index + 1, 'TEXT')}><Plus size={15}/> Вставить блок</button></div>
          </div>)}
          <div className="document-add-row"><button onClick={() => insert(draft.blocks.length, 'TEXT')}><Plus size={16}/> Текст</button><button onClick={() => insert(draft.blocks.length, 'IMAGE')}><ImagePlus size={16}/> Изображение</button></div>
        </section>
      </>}
      {settingsOpen && <aside className="lesson-settings-panel">
        <div className="settings-tabs"><button className={section === 'settings' ? 'active' : ''} onClick={() => setSection('settings')}>Настройки</button><button className={section === 'test' ? 'active' : ''} onClick={() => setSection('test')}>Тест</button><button className={section === 'practice' ? 'active' : ''} onClick={() => setSection('practice')}>Практика</button></div>
        {section === 'settings' && <div className="settings-panel-content"><h2>Параметры урока</h2><p>Изменения остаются черновиком, пока вы отдельно не опубликуете урок.</p>{selected?.type === 'IMAGE' && selectedIndex !== null ? <><label className="image-replace">{selected.media_url ? 'Заменить изображение' : 'Загрузить изображение'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file && selectedIndex !== null) void upload(selectedIndex, file); event.currentTarget.value = '' }}/></label><label>Подпись<input value={selected.content} onChange={event => updateBlock(selectedIndex, { content: event.target.value })}/></label><label>Ширина изображения<select value={String(selected.config.width ?? 'wide')} onChange={event => updateBlock(selectedIndex, { config: { ...selected.config, width: event.target.value } })}><option value="wide">Широкая</option><option value="reading">По ширине текста</option></select></label>{selected.media_url && <img className="settings-image" src={selected.media_url} alt="Загруженный файл"/>}</> : <p>Выберите изображение в документе, чтобы изменить файл и подпись.</p>}
          <dl><dt>Статус</dt><dd>{status === 'PUBLISHED' ? 'Опубликован' : 'Черновик'}</dd><dt>Положение</dt><dd>{lesson?.position !== undefined ? lesson.position + 1 : '—'}</dd></dl>
        </div>}
        {section === 'test' && <div className="settings-panel-content"><h2>Проверка знаний</h2><p>Управляйте вопросами в существующем конструкторе тестов.</p><Button variant="secondary" onClick={() => { if (!dirty || window.confirm('Есть несохранённые изменения. Перейти к тесту?')) navigate(`/admin/lessons/${id}/test`) }}>Открыть конструктор</Button></div>}
        {section === 'practice' && <div className="settings-panel-content"><h2>Практическая работа</h2><p>Место для будущих заданий и лабораторных работ.</p><span className="coming-soon">Раздел можно будет подключить позже</span></div>}
      </aside>}
    </div>
  </EditorLayout>
}

function BlockPreview({ block }: { block: Block }) {
  if (block.type === 'IMAGE') return <figure className={`preview-image ${block.config.width === 'reading' ? 'reading-width' : ''}`}>{block.media_url && <img src={block.media_url} alt={block.content || 'Изображение урока'}/ >}{block.content && <figcaption>{block.content}</figcaption>}</figure>
  let isTiptap = false
  try { isTiptap = JSON.parse(block.content)?.type === 'doc' } catch { /* old Markdown */ }
  return <div className="markdown">{isTiptap ? <RichLessonContent value={block.content}/> : <ReactMarkdown skipHtml>{block.content}</ReactMarkdown>}</div>
}
