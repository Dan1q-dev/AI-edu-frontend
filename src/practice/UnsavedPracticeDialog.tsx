import { useEffect, useRef } from 'react'
import { Button } from '../components/ui'
import { useI18n } from '../i18n'

export function UnsavedPracticeDialog({ busy, canSave, error, onCancel, onDiscard, onSave }: {
  busy: boolean; canSave: boolean; error: string; onCancel: () => void; onDiscard: () => void; onSave: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} className="practice-leave-dialog" aria-labelledby="practice-leave-title" aria-describedby="practice-leave-description"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id="practice-leave-title">{t('Есть несохранённые изменения')}</h2>
    <p id="practice-leave-description">{t('Сохраните изменения в черновик перед выходом или выйдите без сохранения.')}</p>
    {error && <p role="alert">{error}</p>}
    <div className="practice-leave-actions">
      <Button variant="secondary" disabled={busy} onClick={onCancel} autoFocus>{t('Остаться')}</Button>
      <Button variant="danger" disabled={busy} onClick={onDiscard}>{t('Выйти без сохранения')}</Button>
      <Button disabled={busy || !canSave} onClick={onSave}>{t(busy ? 'Сохранение…' : 'Сохранить и выйти')}</Button>
    </div>
  </dialog>
}
