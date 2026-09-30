import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowDown, ArrowUp, Copy, Eye, ImagePlus, MoreHorizontal, Plus, Settings2, Trash2, X } from 'lucide-react'
import { api, type Block, type Lesson } from './api'
import { Button, ErrorState, Loading, Notice, Select } from './components/ui'
import { prepareImageForUpload } from './utils/image'
import { LessonTextEditor, parseLessonContent } from './components/LessonTextEditor'
import { RichLessonContent } from './components/RichLessonContent'
import { EditorLayout, type SaveState } from './layouts/EditorLayout'
import { useLeaveWarning } from './useLeaveWarning'
import './lesson-editor.css'
import { useI18n } from './i18n'

type Draft = { title: string; description: string; blocks: Block[] }
const normalize = (blocks: Block[]) => blocks.map((block, position) => ({ ...block, position }))
const blankDraft: Draft = { title: '', description: '', blocks: [] }
const emptyTextBlock = (): Block => ({ type: 'TEXT', position: 0, content: JSON.stringify(parseLessonContent('')), media: null, config: {} })

export function EditorPage({ lessonId, backLabel }: { lessonId?: string; backLabel?: string } = {}) {
  const { t } = useI18n()
  const { id: routeId = '' } = useParams(), id = lessonId ?? routeId, qc = useQueryClient()
  const lessonQuery = useQuery({ queryKey: ['admin-lesson', id], queryFn: () => api<Lesson>(`lessons/${id}/`) })
  const draftQuery = useQuery({ queryKey: ['admin-draft', id], queryFn: () => api<Draft>(`lessons/${id}/draft/`) })
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [menuIndex, setMenuIndex] = useState<number | null>(null)
  const draftRef = useRef(draft), dirtyRef = useRef(false), requestRef = useRef<Promise<void> | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [formatRequest, setFormatRequest] = useState<{ index: number; type: string; sequence: number } | null>(null)
  const status = lessonQuery.data?.status ?? 'DRAFT'

  useEffect(() => {
    if (!draftQuery.data || dirtyRef.current) return
    const blocks = normalize(draftQuery.data.blocks ?? [])
    const next = { ...draftQuery.data, blocks: blocks.length ? blocks : [emptyTextBlock()] }
    setDraft(next); draftRef.current = next; setSelectedIndex(null)
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
    }).catch(error => { setSaveState('error'); setNotice(error instanceof Error ? error.message : t('Не удалось сохранить черновик')) }).finally(() => { requestRef.current = null })
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
  }
  const updateBlock = (index: number, patch: Partial<Block>) => changeBlocks(draftRef.current.blocks.map((block, at) => at === index ? { ...block, ...patch } : block))
  const changeTextType = (index: number, type: string) => setFormatRequest(current => ({ index, type, sequence: (current?.sequence ?? 0) + 1 }))
  const moveBlock = (from: number, to: number) => {
    if (to < 0 || to >= draftRef.current.blocks.length) return
    const blocks = [...draftRef.current.blocks]; const [block] = blocks.splice(from, 1); if (block) blocks.splice(to, 0, block)
    changeBlocks(blocks); setSelectedIndex(to)
  }
  const duplicateBlock = (index: number) => { const blocks = [...draftRef.current.blocks]; const copy = { ...blocks[index]!, id: undefined, config: { ...blocks[index]!.config } }; blocks.splice(index + 1, 0, copy); changeBlocks(blocks); setSelectedIndex(index + 1); setMenuIndex(null) }
  const upload = async (index: number, file: File) => {
    setUploading(true)
    try {
      const prepared = await prepareImageForUpload(file)
      const form = new FormData(); form.append('file', prepared)
      const media = await api<{ id: number; url: string }>('media/', 'POST', form)
      updateBlock(index, { media: media.id, media_url: media.url })
    } catch (error) { setSaveState('error'); setNotice(error instanceof Error ? error.message : t('Не удалось загрузить изображение')) }
    finally { setUploading(false) }
  }
  const saveDraft = async () => { setBusy(true); setNotice(''); try { await persistLatest(); if (dirtyRef.current) throw new Error(t('Черновик не сохранён. Проверьте подключение и повторите попытку.')); setNotice(t('Черновик сохранён')) } catch (error) { setSaveState('error'); setNotice(error instanceof Error ? error.message : t('Не удалось сохранить черновик')) } finally { setBusy(false) } }
  const publish = async () => {
    setBusy(true); setNotice('')
    try {
      await persistLatest()
      if (dirtyRef.current) throw new Error(t('Сначала устраните ошибку сохранения черновика.'))
      await api(`lessons/${id}/draft/`, 'POST')
      await qc.invalidateQueries({ queryKey: ['admin-lesson', id] }); await qc.invalidateQueries({ queryKey: ['admin-draft', id] })
      await qc.invalidateQueries({ queryKey: ['admin', 'items'] })
      setNotice(t('Лекция опубликована'))
    } catch (error) { setSaveState('error'); setNotice(error instanceof Error ? error.message : t('Не удалось опубликовать урок')) }
    finally { setBusy(false) }
  }
  const lesson = lessonQuery.data
  if (lessonQuery.isLoading || draftQuery.isLoading) return <Loading/>
  if (lessonQuery.error || draftQuery.error) return <ErrorState error={lessonQuery.error || draftQuery.error}/>
  const selected = selectedIndex === null ? null : draft.blocks[selectedIndex] ?? null
  const editorActions = <><button className="editor-icon-action" aria-label={t("Панель свойств")} aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}><Settings2 size={17}/></button><Button variant="secondary" onClick={() => setPreview(value => !value)}><Eye size={16}/>{preview ? t('Редактор') : t('Предпросмотр')}</Button><Button disabled={busy || uploading} onClick={() => void publish()}>{status === 'PUBLISHED' ? t('Опубликовать изменения') : t('Опубликовать')}</Button><details className="editor-more-menu"><summary className="editor-icon-action" aria-label={t("Дополнительные действия")}><MoreHorizontal size={18}/></summary><div><button disabled={!dirty || busy} onClick={() => void saveDraft()}>{t('Сохранить сейчас')}</button></div></details></>
  return <EditorLayout title={draft.title || t('Новая лекция')} status={status} saveState={uploading ? 'saving' : saveState} actions={editorActions} backLabel={backLabel}>
    <div className={`lesson-editor-shell ${settingsOpen ? 'with-settings' : ''}`}>
      {notice && <Notice text={notice} kind={saveState === 'error' ? 'error' : 'success'}/>}
      {preview ? <article className="lesson-document lesson-preview"><h1>{draft.title}</h1>{draft.description && <p className="lesson-summary">{draft.description}</p>}{draft.blocks.map((block, index) => <BlockPreview key={block.id ?? index} block={block}/>)}</article> : <>
        <div className="lesson-document-heading"><input aria-label={t("Название лекции")} value={draft.title} placeholder={t("Название лекции")} maxLength={200} onChange={event => updateDraft({ ...draft, title: event.target.value })}/><textarea aria-label={t("Описание лекции")} value={draft.description} placeholder={t("Краткое описание…")} rows={1} onChange={event => updateDraft({ ...draft, description: event.target.value })}/></div>
        <section className="lesson-document" aria-label={t("Содержание лекции")}>
          {draft.blocks.map((block, index) => <div key={block.id ?? `draft-${index}`} className="document-block" draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) moveBlock(from, index) }}>
            <div className="document-block-tools"><span>{block.type === 'TEXT' ? t('ТЕКСТ') : t('ИЗОБРАЖЕНИЕ')} · {String(index + 1).padStart(2, '0')}</span><button aria-label={t("Действия блока")} onClick={() => setMenuIndex(menuIndex === index ? null : index)}><MoreHorizontal size={18}/></button>
              {menuIndex === index && <div className="block-context-menu"><button disabled={index === 0} onClick={() => { moveBlock(index, index - 1); setMenuIndex(null) }}><ArrowUp size={15}/>{t('Выше')}</button><button disabled={index === draft.blocks.length - 1} onClick={() => { moveBlock(index, index + 1); setMenuIndex(null) }}><ArrowDown size={15}/>{t('Ниже')}</button><button onClick={() => duplicateBlock(index)}><Copy size={15}/>{t('Дублировать')}</button><button onClick={() => insert(index + 1, block.type)}><Plus size={15}/>{t('Добавить после')}</button><button className="danger-action" onClick={() => { const blocks = draftRef.current.blocks.filter((_, at) => at !== index); changeBlocks(blocks); setSelectedIndex(blocks.length ? Math.min(index, blocks.length - 1) : null); setMenuIndex(null) }}><Trash2 size={15}/>{t('Удалить')}</button></div>}
            </div>
            {block.type === 'TEXT' ? <div className={selectedIndex === index ? 'selected-document-block' : ''} style={{ textAlign: block.config.align === 'center' || block.config.align === 'right' ? block.config.align : 'left' }} onFocus={() => setSelectedIndex(index)}><LessonTextEditor value={block.content} onChange={content => updateBlock(index, { content })} formatRequest={formatRequest?.index === index ? `${formatRequest.sequence}:${formatRequest.type}` : undefined} onInsertImage={() => insert(index + 1, 'IMAGE')} onDropImage={file => { insert(index + 1, 'IMAGE'); void upload(index + 1, file) }}/></div> : <figure className={`document-image-block ${block.config.width === 'reading' ? 'reading-width' : ''}`} onClick={() => setSelectedIndex(index)}>{block.media_url ? <img src={block.media_url} alt={String(block.config.alt || block.content || t('Изображение лекции'))}/>: <label className="image-dropzone"><ImagePlus size={24}/>{t('Загрузите изображение')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(index, file); event.currentTarget.value = '' }}/></label>}{block.media_url && block.content && <figcaption>{block.content}</figcaption>}</figure>}
            <div className="insert-between"><button onClick={() => insert(index + 1, 'TEXT')}><Plus size={15}/>{t('Вставить блок')}</button></div>
          </div>)}
          <div className="document-add-row"><button onClick={() => insert(draft.blocks.length, 'TEXT')}><Plus size={16}/>{t('Текст')}</button><button onClick={() => insert(draft.blocks.length, 'IMAGE')}><ImagePlus size={16}/>{t('Изображение')}</button></div>
        </section>
      </>}
      {settingsOpen && <aside className="lesson-settings-panel">
        <div className="inspector-heading"><strong>{selected?.type === 'IMAGE' ? t('Изображение') : selected?.type === 'TEXT' ? t('Текст') : t('Параметры лекции')}</strong><button aria-label={t("Закрыть панель")} onClick={() => setSettingsOpen(false)}><X size={17}/></button></div>
        <div className="settings-panel-content">{selected?.type === 'IMAGE' && selectedIndex !== null ? <><label className="image-replace">{selected.media_url ? t('Заменить изображение') : t('Загрузить изображение')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(selectedIndex, file); event.currentTarget.value = '' }}/></label><label>{t('Подпись')}<input value={selected.content} onChange={event => updateBlock(selectedIndex, { content: event.target.value })}/></label><label>{t('Альтернативный текст')}<input value={String(selected.config.alt ?? '')} onChange={event => updateBlock(selectedIndex, { config: { ...selected.config, alt: event.target.value } })}/></label><label>{t('Ширина изображения')}<Select value={String(selected.config.width ?? 'wide')} onChange={event => updateBlock(selectedIndex, { config: { ...selected.config, width: event.target.value } })}><option value="wide">{t('Широкая')}</option><option value="reading">{t('По ширине текста')}</option></Select></label><button className="inspector-delete" onClick={() => { changeBlocks(draftRef.current.blocks.filter((_, at) => at !== selectedIndex)); setSelectedIndex(null) }}>{t('Удалить изображение')}</button></> : selected?.type === 'TEXT' && selectedIndex !== null ? <><label>{t('Тип блока')}<Select value={parseLessonContent(selected.content).content?.[0]?.type ?? 'paragraph'} onChange={event => changeTextType(selectedIndex, event.target.value)}><option value="paragraph">{t('Текст')}</option><option value="heading">{t('Заголовок')}</option><option value="bulletList">{t('Маркированный список')}</option><option value="orderedList">{t('Нумерованный список')}</option><option value="blockquote">{t('Цитата')}</option><option value="codeBlock">{t('Код')}</option></Select></label><label>{t('Выравнивание')}<Select value={String(selected.config.align ?? 'left')} onChange={event => updateBlock(selectedIndex, { config: { ...selected.config, align: event.target.value } })}><option value="left">{t('Слева')}</option><option value="center">{t('По центру')}</option><option value="right">{t('Справа')}</option></Select></label></> : <><p>{t('Черновик сохраняется автоматически. Студенты увидят изменения после публикации.')}</p><label>{t('Описание')}<textarea rows={4} value={draft.description} onChange={event => updateDraft({ ...draftRef.current, description: event.target.value })}/></label><dl><dt>{t('Статус')}</dt><dd>{status === 'PUBLISHED' ? t('Опубликован') : t('Черновик')}</dd><dt>{t('Положение')}</dt><dd>{lesson?.position !== undefined ? lesson.position + 1 : '—'}</dd></dl></>}</div>
      </aside>}
    </div>
  </EditorLayout>
}

function BlockPreview({ block }: { block: Block }) {
  const { t } = useI18n()
  if (block.type === 'IMAGE') return <figure className={`preview-image ${block.config.width === 'reading' ? 'reading-width' : ''}`}>{block.media_url && <img src={block.media_url} alt={block.content || t('Изображение урока')}/ >}{block.content && <figcaption>{block.content}</figcaption>}</figure>
  let isTiptap = false
  try { isTiptap = JSON.parse(block.content)?.type === 'doc' } catch { /* old Markdown */ }
  return <div className="markdown">{isTiptap ? <RichLessonContent value={block.content}/> : <ReactMarkdown skipHtml>{block.content}</ReactMarkdown>}</div>
}
