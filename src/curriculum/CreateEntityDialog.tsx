import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button, Input } from '../components/ui'
import type { EntityKind } from './types'
import { useI18n } from '../i18n'

export function CreateEntityDialog({ kind, onCreate, onClose }: {
  kind: EntityKind
  onCreate: (title: string) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    setBusy(true); setError('')
    try { await onCreate(title.trim()); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t('Не удалось создать материал')) }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <form className="curriculum-create-dialog" role="dialog" aria-modal="true" aria-labelledby="curriculum-create-title" onSubmit={event => void submit(event)}>
      <div className="curriculum-create-heading"><div><span className="eyebrow">{t('НОВЫЙ МАТЕРИАЛ')}</span><h2 id="curriculum-create-title">{t('Создать')} {t(({ courses: 'курс', modules: 'модуль', items: 'учебный элемент' } as const)[kind])}</h2></div><button type="button" aria-label={t('Закрыть')} onClick={onClose} disabled={busy}><X size={18}/></button></div>
      <label>{t('Название')}<Input autoFocus maxLength={200} value={title} placeholder={`${t('Название')} ${t(({ courses: 'курса', modules: 'модуля', items: 'элемента' } as const)[kind])}`} onChange={event => setTitle(event.target.value)}/></label>
      {error && <p role="alert" className="curriculum-form-error">{error}</p>}
      <div className="curriculum-create-actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t('Отмена')}</Button><Button type="submit" disabled={busy || !title.trim()}>{busy ? t('Создание…') : t('Создать')}</Button></div>
    </form>
  </div>
}
