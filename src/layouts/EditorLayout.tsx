import { ArrowLeft } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
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
  const track = params.get('track')
  const defaultBackHref = `/admin/curriculum${track ? `?track=${encodeURIComponent(track)}` : ''}`
  return <div className="editor-layout">
    <header className="editor-header">
      <Link to={backHref || defaultBackHref} className="editor-back"><ArrowLeft size={17}/><span>{backLabel || t('Структура курса')}</span></Link>
      <div className="editor-header-title"><strong>{title}</strong><span className={`save-state ${saveState}`}><i/> {t(saveLabelKey[saveState])}</span></div>
      <div className="editor-header-actions">{actions}<span className={`status ${status === 'PUBLISHED' ? 'published' : ''}`}>{statusLabel || t(status === 'PUBLISHED' ? 'Опубликован' : 'Черновик')}</span></div>
    </header>
    <main className="editor-main">{children}</main>
  </div>
}
