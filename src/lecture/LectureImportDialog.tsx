import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileUp, LoaderCircle, X } from 'lucide-react'
import { api, ApiError, type Block } from '../api'
import { RichLessonContent } from '../components/RichLessonContent'
import { useI18n } from '../i18n'
import './lecture-import.css'

type Element = { source_id: string; kind: string; text: string; page?: number; rows?: { text: string }[][] }
export type LectureImportJob = {
  id: string; name: string; size: number; status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; stage: string; error: string; source_url: string
  result: null | { blocks: Block[]; pages: { page: number; url: string }[]; elements: Element[]; warnings: string[]; stats: { elements: number; images: number } }
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
const elementLabels: Record<string, string> = { paragraph: 'Текст', heading: 'Заголовок', quote: 'Цитата', code: 'Блок кода', bullet: 'Маркированный список', ordered: 'Нумерованный список', image: 'Изображение', table: 'Таблица', formula: 'Формула LaTeX' }

export function LectureImportDialog({ lessonId, onClose, onApply }: { lessonId: string; onClose: () => void; onApply: (blocks: Block[], mode: 'append' | 'replace') => void }) {
  const { t } = useI18n(), qc = useQueryClient()
  const root = `lessons/${lessonId}/imports/`
  const [selected, setSelected] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null), [uploading, setUploading] = useState(false)
  const [useAi, setUseAi] = useState(true), [forceOcr, setForceOcr] = useState(false)
  const [mode, setMode] = useState<'append' | 'replace'>('append'), [error, setError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose); closeRef.current = onClose
  const history = useQuery({ queryKey: ['lecture-imports', lessonId], queryFn: () => api<{ jobs: LectureImportJob[]; ai_available: boolean }>(root) })
  const jobId = selected ?? history.data?.jobs[0]?.id
  const query = useQuery({ queryKey: ['lecture-import', lessonId, jobId], queryFn: () => api<LectureImportJob>(`${root}${jobId}/`), enabled: !!jobId,
    refetchInterval: query => ['PENDING', 'RUNNING'].includes(query.state.data?.status ?? '') ? 1500 : false })
  const job = query.data ?? history.data?.jobs.find(item => item.id === jobId)
  const active = !!job && ['PENDING', 'RUNNING'].includes(job.status)
  const result = !file ? job?.result : null
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')
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
    if (file.size > 30 * 1024 * 1024) { setError(t('Максимальный размер файла — 30 МБ.')); return }
    setUploading(true); setError('')
    try {
      const form = new FormData(); form.append('file', file); form.append('use_ai', String(useAi && history.data?.ai_available)); form.append('force_ocr', String(forceOcr))
      const created = await api<LectureImportJob>(root, 'POST', form)
      qc.setQueryData(['lecture-import', lessonId, created.id], created)
      setSelected(created.id); setFile(null)
      void qc.invalidateQueries({ queryKey: ['lecture-imports', lessonId] })
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 413 ? t('Сервер ограничил размер файла. Загрузите файл меньшего размера.') : cause instanceof Error ? cause.message : t('Не удалось загрузить файл'))
      if (cause instanceof ApiError && cause.status === 409) { setSelected(null); setFile(null); void qc.invalidateQueries({ queryKey: ['lecture-imports', lessonId] }) }
    }
    finally { setUploading(false) }
  }
  return createPortal(<div className="lecture-import-backdrop"><div className="lecture-import-dialog" ref={panel} role="dialog" aria-modal="true" aria-labelledby="lecture-import-title" tabIndex={-1}>
    <header><div><h2 id="lecture-import-title">{t('Импорт лекции из файла')}</h2><p>{t('Загрузите материал, проверьте результат и перенесите его в редактор.')}</p></div><button type="button" aria-label={t('Закрыть')} onClick={onClose}><X size={21}/></button></header>
    <div className="lecture-import-body">
      <div className="lecture-import-upload">
        <label className="lecture-import-file"><FileUp size={24}/><span><strong>{file?.name ?? t('Выбрать файл')}</strong><small>PDF, DOCX, PPTX · {t('до 30 МБ')}</small></span><input type="file" aria-label={t('Файл лекции')} accept=".pdf,.docx,.pptx" disabled={uploading || active} onChange={event => { setFile(event.target.files?.[0] ?? null); setError('') }}/></label>
        <button type="button" disabled={!file || uploading || active} onClick={() => void start()}>{t(uploading ? 'Загрузка…' : 'Распознать файл')}</button>
      </div>
      <details className="lecture-import-options"><summary>{t('Настройки распознавания')}</summary><label><input type="checkbox" checked={useAi && !!history.data?.ai_available} disabled={uploading || active || !history.data?.ai_available} onChange={event => setUseAi(event.target.checked)}/>{t('Уточнить структуру с ИИ без изменения текста')}</label><label><input type="checkbox" checked={forceOcr} disabled={uploading || active} onChange={event => setForceOcr(event.target.checked)}/>{t('Распознать PDF полностью через OCR')}</label><p>{t('Русский, қазақша, English. Сложные формулы и схемы могут потребовать ручной правки.')}</p></details>
      {history.data && history.data.jobs.length > 0 && <label className="lecture-import-history">{t('Последние импорты')}<select aria-label={t('Последние импорты')} value={jobId ?? ''} disabled={uploading} onChange={event => { setSelected(event.target.value); setFile(null); setError('') }}>{history.data.jobs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {(error || history.error || query.error || (!file && job?.error)) && <p className="lecture-import-error" role="alert">{error || (history.error || query.error)?.message || job?.error}</p>}
      {(uploading || active) && <div className="lecture-import-progress" role="status"><LoaderCircle size={23} className="lecture-import-spinner"/><div><strong>{t(uploading ? 'Загрузка файла' : job?.stage === 'structuring' ? 'Восстанавливаем структуру' : job?.stage === 'validating' ? 'Проверяем результат' : job?.status === 'PENDING' ? 'Файл в очереди' : 'Извлекаем текст и изображения')}</strong><p>{t('Можно закрыть окно. Результат останется в последних импортах.')}</p></div></div>}
      {result && <>
        {result.warnings.length > 0 && <details className="lecture-import-warnings" open><summary>{t('Что проверить после переноса')}</summary><ul>{result.warnings.map(code => <li key={code}>{t(warnings[code] ?? 'Проверьте результат по исходному файлу.')}</li>)}</ul></details>}
        <div className="lecture-import-review">
          <section aria-label={t('Исходный материал')}><h3>{t('Исходный материал')} <a href={job!.source_url} target="_blank" rel="noreferrer">{t('Открыть файл')}</a></h3><div className="lecture-import-source">{result.pages.length ? result.pages.map(page => <figure key={page.page}><figcaption>{t('Страница')} {page.page}</figcaption><img src={page.url} alt={`${t('Страница')} ${page.page}`} loading="lazy"/></figure>) : <><p className="lecture-import-source-note">{t('Извлечённое содержимое. Исходное оформление доступно в файле.')}</p>{result.elements.map(element => <div key={element.source_id} className="lecture-import-source-element"><small>{element.page ? `${t('Слайд')} ${element.page} · ` : ''}{t(elementLabels[element.kind] ?? 'Текст')}</small><p>{element.text || element.rows?.map(row => row.map(cell => cell.text).join(' | ')).join('\n') || t('Изображение')}</p></div>)}</>}</div></section>
          <section aria-label={t('Результат импорта')}><h3>{t('Результат импорта')}</h3><article className="lecture-import-result markdown">{result.blocks.map((block, index) => block.type === 'IMAGE' ? <figure key={index}><img src={block.media_url ?? `/api/v1/media/${block.media}/`} alt={block.content}/>{block.content && <figcaption>{block.content}</figcaption>}</figure> : <RichLessonContent key={index} value={block.content}/>)}</article></section>
        </div>
      </>}
    </div>
    <footer><div className="lecture-import-mode"><label><input type="radio" name="lecture-import-mode" value="append" checked={mode === 'append'} onChange={() => setMode('append')}/>{t('Добавить в конец')}</label><label><input type="radio" name="lecture-import-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')}/>{t('Заменить содержимое')}</label><small>{t('Название и вложения сохранятся. Перенос можно отменить в редакторе.')}</small></div><div><button type="button" onClick={onClose}>{t('Закрыть')}</button><button type="button" disabled={!result || uploading || active} onClick={() => { if (result) { try { onApply(result.blocks, mode) } catch (cause) { setError(cause instanceof Error ? cause.message : t('Не удалось перенести содержимое')) } } }}>{t('Перенести в черновик')}</button></div></footer>
  </div></div>, document.body)
}
