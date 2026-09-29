import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button {...props} className={`button ${variant} ${className}`}>{children}</button>
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className || ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className || ''}`} />
}

export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return <div className="notice" role="status" aria-live="polite">{label}</div>
}

export function ErrorState({ error }: { error: unknown }) {
  return <div className="notice error" role="alert">{error instanceof Error ? error.message : 'Не удалось загрузить данные'}</div>
}

export function Notice({ text, kind = 'success' }: { text: string; kind?: 'success' | 'error' }) {
  return text ? <div role={kind === 'error' ? 'alert' : 'status'} className={`toast ${kind}`}>{text}</div> : null
}

export function Confirm({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h3 id="confirm-title">{title}</h3>
      <div className="row"><Button variant="danger" onClick={onConfirm}>Подтвердить</Button><Button variant="secondary" onClick={onCancel}>Отмена</Button></div>
    </div>
  </div>
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

export { TrackSelect } from './TrackSelect'
