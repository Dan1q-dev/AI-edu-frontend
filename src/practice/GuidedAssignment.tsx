import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Input, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import type { RuntimeProps } from './types'
import { safeResultLink, type TaskConfig } from './commonTask'

export type AssignmentConfig = TaskConfig

export function GuidedAssignment({ state, busy, draft, onDraftChange, onBackToTask, onReview, onSubmit }: RuntimeProps) {
  const { t } = useI18n()
  const submitted = !!state.submission && state.submission.status !== 'IN_PROGRESS'
  const [local, setLocal] = useState<Record<string, unknown>>(state.submission?.submission_data ?? {})
  const [dirty, setDirty] = useState(false)
  const value = submitted ? state.submission!.submission_data : draft ?? local
  const report = String(value.report ?? ''), artifact = String(value.artifact_url ?? '')
  const change = (next: Record<string, unknown>) => {
    setDirty(true); setLocal(next); onDraftChange?.(next)
  }
  useLeaveWarning(dirty && !submitted)
  const ready = report.trim().length >= 40 && (!artifact || !!safeResultLink(artifact))
  const review = () => {
    if (!ready || busy) return
    const data = { report: report.trim(), artifact_url: artifact.trim() }
    if (onReview) onReview(data, { files: artifact ? [{ name: t('Открыть результат'), url: artifact }] : [] })
    else void onSubmit(data)
  }
  return <section className="guided-assignment-execution">
    <h2>{t('Результат работы')}</h2>
    <p className="muted">{t('Подготовьте результат по инструкции задания. Затем перейдите к самопроверке.')}</p>
    <form className="assignment-report" onSubmit={event => { event.preventDefault(); review() }}>
      <label>{t('Отчёт о выполнении')}<Textarea rows={9} maxLength={20000} minLength={40} required disabled={busy || submitted} value={report}
        onChange={event => change({ ...value, report: event.target.value })} placeholder={t('Что Вы подготовили? Какие источники использовали, что проверили и исправили самостоятельно?')}/>
        <small>{report.trim().length} / 20000 · {t('минимум 40 символов')}</small></label>
      <label>{t('Ссылка на результат (необязательно)')}<Input type="url" maxLength={2000} disabled={busy || submitted} placeholder="https://" value={artifact}
        onChange={event => change({ ...value, artifact_url: event.target.value })}/></label>
      <div className="practice-flow-actions">{onBackToTask && <Button type="button" variant="secondary" onClick={onBackToTask}><ArrowLeft size={16}/>{t('К заданию')}</Button>}
        <Button type="submit" disabled={busy || !ready}>{t('Перейти к самопроверке')}<ArrowRight size={16}/></Button></div>
    </form>
  </section>
}
