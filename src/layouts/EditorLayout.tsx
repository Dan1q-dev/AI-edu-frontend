import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const saveLabel: Record<SaveState, string> = {
  saved: 'Сохранено', dirty: 'Есть изменения', saving: 'Сохранение…', error: 'Ошибка сохранения',
}

export function EditorLayout({ children, title, status, saveState, actions }: {
  children: ReactNode
  title: string
  status: string
  saveState: SaveState
  actions: ReactNode
}) {
  return <div className="editor-layout">
    <header className="editor-header">
      <Link to="/admin/curriculum" className="editor-back"><ArrowLeft size={17}/><span>Уроки</span></Link>
      <div className="editor-header-title"><strong>{title}</strong><span className={`save-state ${saveState}`}><i/> {saveLabel[saveState]}</span></div>
      <div className="editor-header-actions">{actions}<span className={`status ${status === 'PUBLISHED' ? 'published' : ''}`}>{status === 'PUBLISHED' ? 'Опубликован' : 'Черновик'}</span></div>
    </header>
    <main className="editor-main">{children}</main>
  </div>
}
