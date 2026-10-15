import { ArrowRight, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LearningItem, Lesson } from '../api'
import { useI18n } from '../i18n'

export function NextItemAction({ next, courseSlug, nextItemId }: { next?: LearningItem | Lesson; courseSlug?: string; nextItemId?: string | null }) {
  const { t } = useI18n()
  return <div className="next-item-action">
    {nextItemId || next ? !nextItemId && next?.is_locked ? <p className="next-item-locked"><LockKeyhole size={18}/>{t('Сначала завершите текущий модуль')}</p> : <Link className="button primary" to={nextItemId ? `/items/${nextItemId}` : next && 'type' in next ? `/items/${next.short_id}` : `/lessons/${next!.short_id}`}><span>{t('Перейти к следующему материалу')}</span><ArrowRight size={18}/></Link> : <Link className="button secondary" to={courseSlug ? `/courses/${courseSlug}` : '/catalog'}>{t(courseSlug ? 'Вернуться к курсу' : 'Перейти в каталог')}<ArrowRight size={18}/></Link>}
  </div>
}
