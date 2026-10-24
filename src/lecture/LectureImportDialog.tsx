import { Select } from '../components/Select'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileUp, LoaderCircle, X } from 'lucide-react'
import { api, ApiError, type Block } from '../api'
import { RichLessonContent } from '../components/RichLessonContent'
import { useI18n } from '../i18n'
import './lecture-import.css'

export type LectureImportJob = {
  id: string; name: string; size: number; status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; stage: string; error: string; source_url: string
  result: null | { blocks: Block[]; warnings: string[] }
}
const warnings: Record<string, string> = {
  office_layout: 'Содержимое преобразовано в документ: расположение элементов может отличаться от исходного файла.',
  ocr_review: 'Проверьте распознанный текст, особенно формулы, числа и фрагменты кода.',
  image_ocr: 'Текст с изображений добавлен рядом с ними. При необходимости удалите повторения.',
  unsupported_image: 'Некоторые изображения не удалось перенести. Добавьте их из исходного файла вручную.',
  chart_not_imported: 'Диаграммы PowerPoint требуют проверки и добавления вручную.',
  header_footer: 'Текст колонтитулов Word добавлен в конец документа.',
  native_formula: 'Формулы Word перенесены текстом. Проверьте их и при необходимости оформите через LaTeX.',
  ai_not_configured: 'Структура определена по исходному файлу. Уточнение с ИИ сейчас недоступно.',
  ai_unavailable: 'Не удалось уточнить часть структуры с ИИ. Исходный текст сохранён.',
  ai_long_element: 'Длинные фрагменты перенесены без уточнения структуры с ИИ.',
}

type ImportDialogProps = { onClose: () => void; onApply: (blocks: Block[], mode: 'append' | 'replace') => void }
export function LectureImportDialog({ lessonId, ...props }: ImportDialogProps & { lessonId: string }) {
  return <DocumentImportDialog root={`lessons/${lessonId}/imports/`} {...props}/>
}

export function PracticeImportDialog({ itemId, ...props }: ImportDialogProps & { itemId: string }) {
  return <DocumentImportDialog root={`items/${itemId}/practice/imports/`} practice {...props}/>
}

function DocumentImportDialog({ root, practice = false, onClose, onApply }: ImportDialogProps & { root: string; practice?: boolean }) {
  const { t } = useI18n(), qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null), [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'append' | 'replace' | null>(null), [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose); closeRef.current = onClose
  const historyKey = ['document-imports', root]
  const history = useQuery({ queryKey: historyKey, queryFn: () => api<{ jobs: LectureImportJob[] }>(root) })
  const jobId = selected ?? history.data?.jobs[0]?.id
  const query = useQuery({ queryKey: ['document-import', root, jobId], queryFn: () => api<LectureImportJob>(`${root}${jobId}/`), enabled: !!jobId,
    refetchInterval: query => ['PENDING', 'RUNNING'].includes(query.state.data?.status ?? '') ? 1500 : false })
  const job = query.data ?? history.data?.jobs.find(item => item.id === jobId)
  const active = !!job && ['PENDING', 'RUNNING'].includes(job.status)
  const result = !file ? job?.result : null
  const visibleWarnings = (result?.warnings ?? []).filter(code => code !== 'office_layout')
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !panel.current?.querySelector('[role="combobox"][aria-expanded="true"]')) { event.preventDefault(); event.stopPropagation(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled):not([hidden]),a[href],[tabindex="0"]')
      if (!items?.length) return
      const first = items[0]!, last = items[items.length - 1]!
      if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard, true)
    return () => { document.removeEventListener('keydown', keyboard, true); document.body.style.overflow = overflow; before?.focus() }
  }, [])
  const start = async () => {
    if (!file || active || uploading) return
    if (file.size > 10 * 1024 * 1024) { setError(t('Максимальный размер файла — 10 МБ.')); return }
    setUploading(true); setError('')
    try {
      const form = new FormData(); form.append('file', file)
      const created = await api<LectureImportJob>(root, 'POST', form)
      qc.setQueryData(['document-import', root, created.id], created)
      setSelected(created.id); setFile(null); setMode(null)
      void qc.invalidateQueries({ queryKey: historyKey })
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 413 ? t('Сервер ограничил размер файла. Загрузите файл меньшего размера.') : cause instanceof Error ? cause.message : t('Не удалось загрузить файл'))
      if (cause instanceof ApiError && cause.status === 409) { setSelected(null); setFile(null); void qc.invalidateQueries({ queryKey: historyKey }) }
    }
    finally { setUploading(false) }
  }
  return createPortal(<div className="lecture-import-backdrop"><div className="lecture-import-dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="lecture-import-title" tabIndex={-1}>
    <header><div><h2 id="lecture-import-title">{t(practice ? 'Импорт инструкции из файла' : 'Импорт лекции из файла')}</h2><p>{t(practice ? 'Загрузите задание, проверьте результат и перенесите его в инструкцию. Критерии самопроверки сохранятся.' : 'Загрузите материал, проверьте результат и перенесите его в редактор.')}</p></div><button type="button" aria-label={t('Закрыть')} onClick={onClose}><X size={21}/></button></header>
    <div className="lecture-import-body">
      <div className="lecture-import-upload">
        <label className="lecture-import-file"><FileUp size={24}/><span><strong>{file?.name ?? t('Выбрать файл')}</strong><small>PDF, DOCX, PPTX · {t('до 10 МБ')}</small></span><input type="file" aria-label={t(practice ? 'Файл инструкции' : 'Файл лекции')} accept=".pdf,.docx,.pptx" disabled={uploading || active} onChange={event => { setFile(event.target.files?.[0] ?? null); setMode(null); setError('') }}/></label>
        <button type="button" disabled={!file || uploading || active} onClick={() => void start()}>{t(uploading ? 'Загрузка…' : 'Распознать файл')}</button>
      </div>
      {history.data && history.data.jobs.length > 0 && <label className="lecture-import-history">{t('Последние импорты')}<Select compact aria-label={t('Последние импорты')} value={jobId ?? ''} disabled={uploading} onChange={event => { setSelected(event.target.value); setFile(null); setMode(null); setError('') }}>{history.data.jobs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>}
      {(error || history.error || query.error || (!file && job?.error)) && <p className="lecture-import-error" role="alert">{error || (history.error || query.error)?.message || job?.error}</p>}
      {(uploading || active) && <div className="lecture-import-progress" role="status"><LoaderCircle size={23} className="lecture-import-spinner"/><div><strong>{t(uploading ? 'Загрузка файла' : job?.stage === 'ocr' ? 'Распознаём текст на изображениях' : job?.stage === 'structuring' ? 'Восстанавливаем структуру' : job?.stage === 'validating' ? 'Проверяем результат' : job?.status === 'PENDING' ? 'Файл в очереди' : 'Извлекаем текст и изображения')}</strong><p>{t('Можно закрыть окно. Результат останется в последних импортах.')}</p></div></div>}
      {result && <>
        {visibleWarnings.length > 0 && <details className="lecture-import-warnings"><summary>{t('Что проверить после переноса')}</summary><ul>{visibleWarnings.map(code => <li key={code}>{t(warnings[code] ?? 'Проверьте результат по исходному файлу.')}</li>)}</ul></details>}
        <div className="lecture-import-review">
          <section aria-label={t('Результат импорта')}><h3>{t('Результат импорта')}</h3><article className="lecture-import-result markdown">{result.blocks.map((block, index) => block.type === 'IMAGE' ? <figure key={index}><img src={block.media_url ?? `/api/v1/media/${block.media}/`} alt={block.content}/>{block.content && <figcaption>{block.content}</figcaption>}</figure> : <RichLessonContent key={index} value={block.content}/>)}</article></section>
        </div>
      </>}
    </div>
    <footer>
      <div className="lecture-import-mode" role="group" aria-label={t('Способ переноса')}>
        {(['append', 'replace'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} disabled={!result || uploading || active} onClick={() => setMode(value)}><span className="lecture-import-mode-check" aria-hidden="true">{mode === value && <Check size={15}/>}</span>{t(value === 'append' ? 'Добавить в конец' : 'Заменить содержимое')}</button>)}
      </div>
      <div><button type="button" onClick={onClose}>{t('Закрыть')}</button><button type="button" disabled={!result || !mode || uploading || active} onClick={() => { if (result && mode) { try { onApply(result.blocks, mode) } catch (cause) { setError(cause instanceof Error ? cause.message : t('Не удалось перенести содержимое')) } } }}>{t(practice ? 'Перенести в инструкцию' : 'Перенести в черновик')}</button></div>
    </footer>
  </div></div>, document.body)
}
