import { ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const saveLabelKey: Record<SaveState, string> = {
  saved: 'Сохранено', dirty: 'Есть изменения', saving: 'Сохранение…', error: 'Ошибка сохранения',
}

export function EditorLayout({ children, title, status, saveState, actions, backLabel, statusLabel, backHref }: {
  children: ReactNode
  title: string
  status: string
  saveState: SaveState
  actions: ReactNode
  backLabel?: string
  statusLabel?: string
  backHref?: string
}) {
  const [params] = useSearchParams()
  const { t } = useI18n()
  const layoutRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (headerRef.current) layoutRef.current?.style.setProperty('--lecture-editor-header-height', `${headerRef.current.offsetHeight}px`)
    })
    if (headerRef.current) observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [])
  const track = params.get('track')
  const defaultBackHref = `/admin/curriculum${track ? `?track=${encodeURIComponent(track)}` : ''}`
  return <div className="editor-layout" ref={layoutRef}>
    <header className="editor-header" ref={headerRef}>
      <Link to={backHref || defaultBackHref} className="editor-back"><ArrowLeft size={17}/><span>{backLabel || t('Структура курса')}</span></Link>
      <div className="editor-header-title"><strong>{title}</strong><span className={`save-state ${saveState}`}><i/> {t(saveLabelKey[saveState])}</span></div>
      <div className="editor-header-actions">{actions}<span className={`status ${status === 'PUBLISHED' ? 'published' : ''}`}>{statusLabel || t(status === 'PUBLISHED' ? 'Опубликован' : 'Черновик')}</span></div>
    </header>
    <main className="editor-main">{children}</main>
  </div>
}
