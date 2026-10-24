import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './notifications.css'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { BookOpen, CircleCheck, CircleAlert, Loader2 } from 'lucide-react'
import { useI18n } from '../i18n'

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

export { Select, type SelectProps } from './Select'

export interface LoadingProps {
  label?: string
  description?: string
  fullPage?: boolean
  variant?: 'fullscreen' | 'page' | 'inline'
  className?: string
}

export function Loading({
  label,
  description,
  fullPage = false,
  variant,
  className = ''
}: LoadingProps) {
  const { t } = useI18n()
  label ??= t('Загрузка…')
  const isFull = fullPage || variant === 'fullscreen'

  if (isFull) {
    return (
      <div
        className={`loading-screen-full ${className}`}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <div className="loading-screen-card">
          <div className="loading-screen-brand">
            <div className="loading-brand-icon" aria-hidden="true">
              <BookOpen size={28} />
            </div>
            <span className="brand">
              AI<span>edu</span>
            </span>
          </div>

          <div className="loading-screen-text">
            <strong>{label}</strong>
            {description && <p>{description}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div
        className={`loading-inline ${className}`}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <Loader2 className="loading-spinner" size={16} aria-hidden="true" />
        <span>{label}</span>
      </div>
    )
  }

  return (
    <div
      className={`loading-section ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="loading-section-content">
        <Loader2 className="loading-spinner" size={28} aria-hidden="true" />
        <div className="loading-section-text">
          <span>{label}</span>
          {description && <small>{description}</small>}
        </div>
      </div>
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const { t } = useI18n()
  return <div className="notice error" role="alert">{error instanceof Error ? error.message : t('Не удалось загрузить данные')}</div>
}

export function Notice({ text, kind = 'success', onDismiss }: { text: string; kind?: 'success' | 'error'; onDismiss?: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const dismiss = useRef(onDismiss)
  useEffect(() => { dismiss.current = onDismiss }, [onDismiss])

  useEffect(() => {
    if (!text) { setVisible(false); return }
    let container = document.getElementById('notification-stack')
    if (!container) {
      container = document.createElement('div')
      container.id = 'notification-stack'
      container.className = 'notification-stack'
      document.body.appendChild(container)
    }
    setHost(container)
    setVisible(true)
    const timer = window.setTimeout(() => {
      setVisible(false)
      dismiss.current?.()
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [text, kind])

  if (!text || !visible || !host) return null
  const Icon = kind === 'error' ? CircleAlert : CircleCheck
  return createPortal(<div role={kind === 'error' ? 'alert' : 'status'} aria-atomic="true" className={`toast notification-toast ${kind}`}>
    <Icon size={20} aria-hidden="true"/><span>{text}</span>
  </div>, host)
}

export function Confirm({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h3 id="confirm-title">{title}</h3>
      <div className="row"><Button variant="danger" onClick={onConfirm}>{t('Подтвердить')}</Button><Button variant="secondary" onClick={onCancel}>{t('Отмена')}</Button></div>
    </div>
  </div>
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

export { TrackSelect } from './TrackSelect'
