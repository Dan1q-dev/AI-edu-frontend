import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Eye, MoreHorizontal, Paperclip, Save } from 'lucide-react'
import { api, type Block, type Lesson, type LessonAttachment } from './api'
import { Button, ErrorState, Loading, Notice } from './components/ui'
import { RichLessonContent } from './components/RichLessonContent'
import { LessonAttachments } from './components/LessonAttachments'
import { EditorLayout, type SaveState } from './layouts/EditorLayout'
import { LectureDocumentEditor } from './lecture/LectureDocumentEditor'
import { useLeaveWarning } from './useLeaveWarning'
import { useI18n } from './i18n'
import './lesson-editor.css'
import './lecture/lecture-authoring.css'

type Draft = { title: string; description: string; blocks: Block[]; attachments: LessonAttachment[]; revision?: number }

export function EditorPage({ lessonId, backLabel }: { lessonId?: string; backLabel?: string } = {}) {
  const { id: routeId = '' } = useParams()
  return <LessonEditor key={lessonId ?? routeId} id={lessonId ?? routeId} backLabel={backLabel}/>
}

function LessonEditor({ id, backLabel }: { id: string; backLabel?: string }) {
  const { t } = useI18n(), qc = useQueryClient()
  const lessonQuery = useQuery({ queryKey: ['admin-lesson', id], queryFn: () => api<Lesson>(`lessons/${id}/`) })
  const draftQuery = useQuery({ queryKey: ['admin-draft', id], queryFn: () => api<Draft>(`lessons/${id}/draft/`) })
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null)
  const [dirty, setDirty] = useState(false), dirtyRef = useRef(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [notice, setNotice] = useState(''), [noticeKind, setNoticeKind] = useState<'success' | 'error'>('success')
  const [busy, setBusy] = useState(false), [uploads, setUploads] = useState(0)
  const [preview, setPreview] = useState(false)
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null)
  const requestRef = useRef<Promise<boolean> | null>(null), mounted = useRef(true)
  const revisionRef = useRef<number | undefined>(undefined)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!draftQuery.data || draftRef.current) return
    const next = { ...draftQuery.data, blocks: draftQuery.data.blocks ?? [], attachments: draftQuery.data.attachments ?? [] }
    draftRef.current = next; setDraft(next)
    revisionRef.current = next.revision
  }, [draftQuery.data])
  useLeaveWarning(dirty || uploads > 0)
  const update = (patch: Partial<Draft>) => {
    if (!draftRef.current) return
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next; dirtyRef.current = true
    setDraft(next); setDirty(true); setSaveState('dirty'); setNotice('')
  }
  const error = (message: string) => { setNoticeKind('error'); setNotice(message) }
  const persist = async (): Promise<boolean> => {
    if (requestRef.current) { const saved = await requestRef.current; if (!saved) return false }
    if (!dirtyRef.current || !draftRef.current) return true
    const snapshot = draftRef.current
    setSaveState('saving')
    const task = api<Draft>(`lessons/${id}/draft/`, 'PUT', { ...snapshot, revision: revisionRef.current }).then(saved => {
      revisionRef.current = saved.revision
      qc.setQueryData(['admin-draft', id], saved)
      if (mounted.current && draftRef.current === snapshot) { dirtyRef.current = false; setDirty(false); setSaveState('saved') }
      return true
    }).catch(cause => {
      if (mounted.current) { setSaveState('error'); error(cause instanceof Error ? cause.message : t('Не удалось сохранить черновик')) }
      return false
    }).finally(() => { requestRef.current = null })
    requestRef.current = task
    return task
  }
  const persistRef = useRef(persist); persistRef.current = persist
  useEffect(() => {
    if (!dirty || uploads || busy) return
    const timer = window.setTimeout(() => { void persistRef.current() }, 800)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, uploads, busy])
  const save = async (publish = false) => {
    if (busy || uploads) return
    setBusy(true); setNotice('')
    try {
      do { if (!await persistRef.current()) return } while (dirtyRef.current)
      if (publish) {
        await api(`lessons/${id}/draft/`, 'POST', { revision: revisionRef.current })
        await Promise.all([qc.invalidateQueries({ queryKey: ['admin-lesson', id] }), qc.invalidateQueries({ queryKey: ['admin', 'items'] }), qc.invalidateQueries({ queryKey: ['admin-draft', id] })])
      }
      setNoticeKind('success'); setNotice(t(publish ? 'Лекция опубликована' : 'Черновик сохранён'))
    } catch (cause) { error(cause instanceof Error ? cause.message : t('Не удалось сохранить черновик')) }
    finally { setBusy(false) }
  }
  const saveRef = useRef(save); saveRef.current = save
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveRef.current() }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [])
  const uploadAttachments = async (files: FileList) => {
    setUploads(count => count + 1); setNotice('')
    try {
      for (const file of Array.from(files)) {
        if ((draftRef.current?.attachments.length ?? 0) >= 20) throw new Error(t('К лекции можно прикрепить не более 20 файлов.'))
        if (file.size > 20 * 1024 * 1024) throw new Error(t('Максимальный размер файла — 20 МБ.'))
        const form = new FormData(); form.append('file', file)
        const uploaded = await api<LessonAttachment>('media/files/', 'POST', form)
        if (mounted.current) update({ attachments: [...(draftRef.current?.attachments ?? []), uploaded] })
      }
    } catch (cause) { if (mounted.current) error(cause instanceof Error ? cause.message : t('Не удалось загрузить файл')) }
    finally { if (mounted.current) setUploads(count => count - 1) }
  }
  if (lessonQuery.isLoading || draftQuery.isLoading) return <Loading/>
  if (lessonQuery.error || draftQuery.error) return <ErrorState error={lessonQuery.error || draftQuery.error}/>
  if (!draft) return <Loading/>
  const status = lessonQuery.data?.status ?? 'DRAFT'
  const actions = <>
    <Button variant="secondary" onClick={() => setPreview(value => !value)} disabled={busy || uploads > 0}><Eye size={16}/>{t(preview ? 'Редактор' : 'Предпросмотр')}</Button>
    <Button disabled={busy || uploads > 0 || !draft.title.trim()} onClick={() => void save(true)}>{t(status === 'PUBLISHED' ? 'Опубликовать изменения' : 'Опубликовать')}</Button>
    <details className="editor-more-menu"><summary className="editor-icon-action" aria-label={t('Дополнительные действия')}><MoreHorizontal size={19}/></summary><div><button disabled={!dirty || busy || uploads > 0} onClick={() => void save()}><Save size={15}/>{t('Сохранить сейчас')}</button></div></details>
  </>
  return <EditorLayout className="lecture-authoring-layout" title={t('Редактор лекции')} status={status} saveState={uploads ? 'saving' : saveState} actions={actions} backLabel={backLabel}>
    <div className="lesson-editor-shell">
      {notice && <Notice text={notice} kind={noticeKind}/>}
      {preview && <article className="lesson-preview lecture-paper"><h1>{draft.title}</h1>{draft.description && <p className="lesson-summary">{draft.description}</p>}{draft.blocks.map((block, index) => <BlockPreview key={index} block={block}/>)}<LessonAttachments attachments={draft.attachments}/></article>}
      <div hidden={preview} className="lecture-editing-view">
        <div className="lecture-ribbon-host" ref={setToolbarTarget}/>
        <div className="lecture-paper">
        <div className="lesson-document-heading"><input disabled={busy} aria-label={t('Название лекции')} value={draft.title} placeholder={t('Название лекции')} maxLength={200} onChange={event => update({ title: event.target.value })}/><textarea disabled={busy} aria-label={t('Описание лекции')} value={draft.description} placeholder={t('Краткое описание…')} rows={2} onChange={event => update({ description: event.target.value })}/></div>
        <section className="lesson-document" aria-label={t('Содержание лекции')}>
          <LectureDocumentEditor lessonId={id} toolbarTarget={toolbarTarget} blocks={draft.blocks} disabled={busy || preview} onChange={blocks => update({ blocks })} onUpload={delta => { if (mounted.current) setUploads(count => count + delta) }} onError={error}/>
        </section>
        <details className="lesson-document lesson-editor-attachments lecture-resources"><summary><Paperclip size={17}/>{t('Материалы для скачивания')}<span>{draft.attachments.length || ''}</span></summary><div><LessonAttachments attachments={draft.attachments} onRemove={busy ? undefined : media => update({ attachments: draftRef.current!.attachments.filter(file => file.media !== media) })}/><label className="lesson-attachment-upload"><Paperclip size={18}/><span>{t(uploads ? 'Загрузка файлов…' : 'Добавить файлы')}</span><input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip" disabled={busy || uploads > 0 || draft.attachments.length >= 20} onChange={event => { if (event.target.files?.length) void uploadAttachments(event.target.files); event.currentTarget.value = '' }}/></label><p>{t('PDF, Word, PowerPoint, Excel, TXT, CSV или ZIP · до 20 МБ на файл. Ученики увидят файлы после публикации.')}</p></div></details>
        </div>
      </div>
    </div>
  </EditorLayout>
}

function BlockPreview({ block }: { block: Block }) {
  const { t } = useI18n()
  if (block.type === 'IMAGE') return <figure className={`lecture-image ${block.config.width === 'reading' ? 'reading-width' : ''}`}><img src={block.media_url || `/api/v1/media/${block.media}/`} alt={String(block.config.alt || block.content || t('Изображение лекции'))}/>{block.content && <figcaption>{block.content}</figcaption>}</figure>
  let isDocument = false
  try { isDocument = JSON.parse(block.content)?.type === 'doc' } catch { /* Legacy Markdown. */ }
  return <div className="markdown" style={{ textAlign: block.config.align === 'center' || block.config.align === 'right' ? block.config.align : 'left' }}>{isDocument ? <RichLessonContent value={block.content}/> : <ReactMarkdown skipHtml>{block.content}</ReactMarkdown>}</div>
}
