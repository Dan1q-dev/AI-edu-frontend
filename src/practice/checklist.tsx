import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import type { ChecklistConfig, ConfigEditorProps, RuntimeProps } from './types'

export function validateChecklist(config: Record<string, unknown>): string | null {
  if (!Array.isArray(config.criteria) || config.criteria.length < 1 || config.criteria.length > 30) return 'Укажите от 1 до 30 критериев'
  for (const row of config.criteria) {
    if (!row || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 300 || typeof row.description !== 'string' || row.description.length > 2000 || typeof row.is_required !== 'boolean') return 'Некорректный критерий самопроверки'
  }
  return null
}

export function ChecklistConfigEditor({ config, onChange, disabled }: ConfigEditorProps) {
  const { t } = useI18n()
  const { criteria } = config as ChecklistConfig
  const change = (index: number, patch: Partial<ChecklistConfig['criteria'][number]>) => onChange({ criteria: criteria.map((row, offset) => offset === index ? { ...row, ...patch } : row) })
  return <fieldset className="practice-config" disabled={disabled}>
    <legend>{t('Критерии самопроверки')}</legend>
    <p>{t('До 30 критериев, не более 300 символов каждый. Результат самопроверки учитывается в готовности модуля.')}</p>
    {criteria.map((row, index) => <div className="practice-criterion-editor" key={index}>
      <label>{t('Критерий')} {index + 1}<Input maxLength={300} value={row.title} onChange={event => change(index, { title: event.target.value })}/></label>
      <label>{t('Описание критерия')}<Textarea maxLength={2000} rows={2} value={row.description} onChange={event => change(index, { description: event.target.value })}/></label>
      <div className="row"><label className="checkbox"><input type="checkbox" checked={row.is_required} onChange={event => change(index, { is_required: event.target.checked })}/>{t('Обязательный критерий')}</label>
        <Button variant="secondary" aria-label={`${t('Удалить критерий')} ${index + 1}`} onClick={() => onChange({ criteria: criteria.filter((_, offset) => offset !== index) })}><Trash2 size={16}/></Button></div>
    </div>)}
    <Button variant="secondary" disabled={disabled || criteria.length >= 30} onClick={() => onChange({ criteria: [...criteria, { title: '', description: '', is_required: true }] })}><Plus size={16}/>{t('Добавить критерий')}</Button>
  </fieldset>
}

export function ChecklistRuntime({ state, busy, onStart, onSubmit }: RuntimeProps) {
  const { t } = useI18n()
  const criteria = (state.version!.config as ChecklistConfig).criteria
  const [checks, setChecks] = useState<boolean[]>([])
  const saved = state.submission?.submission_data.checks as boolean[] | undefined
  useEffect(() => { setChecks(saved ?? criteria.map(() => false)) }, [saved, state.version?.id, state.submission?.id])
  const active = state.submission?.status === 'IN_PROGRESS'
  return <div className="card form-card practice-runtime">
    <h2>{state.version!.title}</h2><p className="practice-description">{state.version!.description}</p>
    <span className="pill">{t('Самопроверка')} · {t('Версия')} {state.version!.version_number}</span>
    <p className="practice-self-assessment">{t('Это ваша самооценка. Система не проверяет выполненную работу автоматически.')}</p>
    <h3>{t('Критерии самопроверки')}</h3>
    <div className="practice-checks">{criteria.map((criterion, index) => <label key={index}>
      <input type="checkbox" disabled={!active || busy} checked={checks[index] ?? false} onChange={event => setChecks(current => criteria.map((_, offset) => offset === index ? event.target.checked : current[offset] ?? false))}/>
      <span>{criterion.title}{criterion.is_required && <small> · {t('Обязательный критерий')}</small>}{criterion.description && <p>{criterion.description}</p>}</span>
    </label>)}</div>
    {state.result && <div className="practice-score" role="status"><strong>{t('Самооценка')}: Ψ = {state.result.psi_value.toFixed(2)}</strong><p>{t(state.is_completed ? 'Практическая работа завершена' : 'Самопроверка сохранена')} · {state.progress_percent}%</p></div>}
    {active ? <Button disabled={busy || checks.length !== criteria.length} onClick={() => void onSubmit({ checks })}>{t('Завершить практическую работу')}</Button>
      : <Button disabled={busy} onClick={() => void onStart()}>{t(state.submission ? 'Новая попытка' : 'Начать практическую работу')}</Button>}
  </div>
}
