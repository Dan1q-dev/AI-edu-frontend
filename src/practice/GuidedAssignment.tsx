import { useState } from 'react'
import { BookOpen, Check, ExternalLink, FileCheck2, RotateCcw, Send } from 'lucide-react'
import { RichLessonContent } from '../components/RichLessonContent'
import { Button, Input, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import type { Criterion, RuntimeProps } from './types'

export type AssignmentConfig = { instructions: string[]; criteria: Criterion[]; source_url?: string }
const safeLink = (value: string) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined } catch { return undefined } }

export function GuidedAssignment(props: RuntimeProps) {
  return <AssignmentForm key={`${props.state.version!.id}:${props.state.submission?.id ?? 'new'}`} {...props}/>
}

function AssignmentForm({ state, busy, onStart, onSubmit }: RuntimeProps) {
  const { t } = useI18n()
  const version = state.version!
  const config = version.config as AssignmentConfig
  const submitted = Boolean(state.submission && state.submission.status !== 'IN_PROGRESS')
  const saved = state.submission?.submission_data
  const [tab, setTab] = useState<'task' | 'report'>('task')
  const [report, setReport] = useState(String(saved?.report ?? ''))
  const [artifact, setArtifact] = useState(String(saved?.artifact_url ?? ''))
  const [checks, setChecks] = useState<boolean[]>(config.criteria.map((_, index) => Boolean((saved?.checks as boolean[] | undefined)?.[index])))
  const [dirty, setDirty] = useState(false)
  useLeaveWarning(dirty && !submitted)
  const ready = report.trim().length >= 40 && (!artifact || Boolean(safeLink(artifact)))
    && config.criteria.every((criterion, index) => !criterion.is_required || checks[index])
  return <section className="guided-assignment">
    <header><span className="eyebrow">{t('ПРАКТИЧЕСКАЯ РАБОТА')}</span><h1>{version.title}</h1>{version.description && <p>{version.description}</p>}</header>
    <div className="assignment-tabs" role="tablist" aria-label={t('Практическая работа')}>
      <button role="tab" aria-selected={tab === 'task'} aria-controls="assignment-task" id="assignment-task-tab" onClick={() => setTab('task')}><BookOpen size={17}/>{t('Задание')}</button>
      <button role="tab" aria-selected={tab === 'report'} aria-controls="assignment-report" id="assignment-report-tab" onClick={() => setTab('report')}><FileCheck2 size={17}/>{t('Результат работы')}</button>
    </div>
    <div role="tabpanel" id="assignment-task" aria-labelledby="assignment-task-tab" hidden={tab !== 'task'}>
      <article className="article markdown assignment-instructions">{config.instructions.map((part, index) => <RichLessonContent key={index} value={part}/>)}</article>
      <div className="assignment-actions">{config.source_url && safeLink(config.source_url) && <a className="button secondary" href={config.source_url} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{t('Исходный документ')}</a>}<Button onClick={() => setTab('report')}><FileCheck2 size={17}/>{t('К результату работы')}</Button></div>
    </div>
    <div role="tabpanel" id="assignment-report" aria-labelledby="assignment-report-tab" hidden={tab !== 'report'}>
      <form className="assignment-report" onSubmit={event => { event.preventDefault(); if (ready && !busy && !submitted) void onSubmit({ report: report.trim(), artifact_url: artifact.trim(), checks }) }}>
        <label>{t('Отчёт о выполнении')}<Textarea rows={9} maxLength={20000} minLength={40} required disabled={busy || submitted} value={report} onChange={event => { setReport(event.target.value); setDirty(true) }} placeholder={t('Что Вы подготовили? Какие источники использовали, что проверили и исправили самостоятельно?')}/><small>{report.trim().length} / 20000 · {t('минимум 40 символов')}</small></label>
        <label>{t('Ссылка на результат (необязательно)')}<Input type="url" maxLength={2000} disabled={busy || submitted} placeholder="https://" value={artifact} onChange={event => { setArtifact(event.target.value); setDirty(true) }}/></label>
        {submitted && artifact && safeLink(artifact) && <a href={artifact} target="_blank" rel="noreferrer"><ExternalLink size={16}/>{t('Открыть результат')}</a>}
        <fieldset disabled={busy || submitted}><legend>{t('Самопроверка')}</legend>{config.criteria.map((criterion, index) => <label className="assignment-check" key={index}><input type="checkbox" checked={checks[index] ?? false} onChange={event => { setChecks(values => values.map((value, i) => i === index ? event.target.checked : value)); setDirty(true) }}/><span><strong>{criterion.title}</strong>{criterion.description && <small>{criterion.description}</small>}</span></label>)}</fieldset>
        {submitted ? <div className="assignment-submitted" role="status"><p><Check size={18}/>{t(state.is_completed ? 'Работа сдана' : 'Работа сохранена, требуется доработка')}</p><p>{t('Самопроверка:')} {checks.filter(Boolean).length} / {checks.length}. {t('Не является оценкой преподавателя или ИИ.')}</p><Button variant="secondary" type="button" disabled={busy} onClick={() => void onStart()}><RotateCcw size={17}/>{t('Новая попытка')}</Button></div> : <Button type="submit" disabled={busy || !ready}><Send size={17}/>{t(busy ? 'Сохранение…' : 'Сдать работу')}</Button>}
      </form>
    </div>
  </section>
}
