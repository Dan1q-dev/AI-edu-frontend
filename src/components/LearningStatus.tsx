import { Check, Circle, CircleCheck, CircleDot, LockKeyhole } from 'lucide-react'
import { useI18n } from '../i18n'

export const learningTypeLabel = (kind: string) => kind === 'TEST' ? 'Тест' : kind === 'PRACTICE' ? 'Практика' : 'Лекция'

export function LearningStatus({
  completed,
  percent = 0,
  locked,
  started,
  iconOnly = false,
  size = 20,
}: {
  completed?: boolean
  percent?: number
  locked?: boolean
  started?: boolean
  iconOnly?: boolean
  size?: number
}) {
  const { t } = useI18n()
  const inProgress = started || percent > 0
  const label = locked ? 'Заблокирован' : completed ? 'Завершён' : inProgress ? 'В процессе' : 'Не начат'

  if (iconOnly) {
    const lockSize = Math.max(16, size - 2)
    const stateClass = locked ? 'is-locked' : completed ? 'is-complete' : inProgress ? 'is-started' : 'is-not-started'
    return (
      <span
        className={`learning-status-icon outline-state ${stateClass}`}
        role="img"
        aria-label={t(label)}
        title={t(label)}
      >
        {locked ? (
          <LockKeyhole size={lockSize} aria-hidden="true" />
        ) : completed ? (
          <CircleCheck size={size} aria-hidden="true" />
        ) : inProgress ? (
          <CircleDot size={size} aria-hidden="true" />
        ) : (
          <Circle size={size} aria-hidden="true" />
        )}
        <span className="sr-only">{t(label)}</span>
      </span>
    )
  }

  return <span className={`learning-status ${locked ? 'locked' : completed ? 'completed' : inProgress ? 'started' : ''}`}>
    {locked ? <LockKeyhole size={12} aria-hidden="true"/> : completed ? <Check size={12} aria-hidden="true"/> : null}{t(label)}
  </span>
}

export function CourseProgressIndicator({ percent, completed, total, bar = true, label }: { percent: number; completed: number; total: number; bar?: boolean; label?: string }) {
  const { t } = useI18n()
  if (label != null) {
    return <div className="course-progress-summary">
      <div className="course-progress-label"><span>{t(label)}</span><strong>{percent}%</strong></div>
      <div className="progress-track" role="progressbar" aria-label={t('Прогресс курса')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></div>
    </div>
  }
  return <div className="course-progress-summary"><div className="course-progress-label"><strong>{percent}%</strong><span>{completed} / {total} {t('элементов завершено')}</span></div>
    {bar && <div className="progress-track" role="progressbar" aria-label={t('Прогресс курса')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></div>}
  </div>
}
