import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { type AdaptiveResult, type LearningItem } from './api'
import { useI18n } from './i18n'

export function LearningItemLink({ item, locked = item.is_locked, children }: { item: LearningItem; locked?: boolean; children: ReactNode }) {
  const { t } = useI18n()
  return locked ? <div className="locked-learning-item" aria-disabled="true" title={t('Сначала завершите предыдущий модуль')}>{children}<LockKeyhole size={16}/></div> : <Link to={`/items/${item.short_id}`}>{children}</Link>
}

export function AdaptiveResultCard({ result }: { result: AdaptiveResult }) {
  const { t } = useI18n()
  return <div className={`result-card ${result.module_completed ? 'passed' : 'failed'}`}>
    <h3>{t(result.module_completed ? 'Модуль освоен' : 'Повторите модуль')}</h3>
    <strong>{result.readiness}%</strong><p>{t('Готовность')} · {t('Порог')} {result.threshold}%</p>
    <div className="adaptive-indicators">{([
      ['Теория', result.theory], ['Практика', result.practice], ['Ошибки', result.errors], ['Компетенции', result.competency],
    ] as const).map(([label, value]) => <span key={label}>{t(label)}: {Math.round(value * 100)}%</span>)}</div>
    <p>{t(result.module_completed ? 'Можно продолжить обучение.' : 'Пройдите материалы и практику ещё раз, затем повторите итоговый тест.')}</p>
    {result.module_completed ? result.next_item_short_id ? <Link className="button" to={`/items/${result.next_item_short_id}`}>{t('Следующий модуль')}</Link> : <p>{t('Все опубликованные модули курса пройдены.')}</p> : <Link className="button" to={`/items/${result.repeat_item_short_id}`}>{t('Повторить модуль')}</Link>}
  </div>
}

export { PracticeRunner } from './practice/PracticeRunner'
