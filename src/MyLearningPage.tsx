import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'
import { api, type CourseLearningSummary, type LearningDashboard, type User } from './api'
import { Button, ErrorState, Loading } from './components/ui'
import { CourseProgressIndicator, LearningStatus } from './components/LearningStatus'
import { useI18n } from './i18n'

function CourseCard({ course }: { course: CourseLearningSummary }) {
  const { t } = useI18n()
  const target = course.is_started && !course.is_completed && course.resume_learning_item ? `/items/${course.resume_learning_item.short_id}` : `/courses/${course.slug}`
  return <article className="learning-course-card card">
    <Link className="learning-course-cover" to={`/courses/${course.slug}`} aria-label={course.title}>{course.cover ? <img src={`/api/v1/media/${course.cover}/`} alt=""/> : <BookOpen size={28} aria-hidden="true"/>}</Link>
    <div className="learning-course-copy"><div className="learning-course-title"><h3><Link to={`/courses/${course.slug}`}>{course.title}</Link></h3>{course.is_completed && <LearningStatus completed/>}</div><p>{course.description}</p>
      {course.is_started && <CourseProgressIndicator percent={course.percent} completed={course.completed_items} total={course.total_items}/>}
      <Link className="button secondary" to={target}>{t(course.is_completed || !course.is_started ? 'Открыть курс' : 'Продолжить')}<ChevronRight size={15}/></Link>
    </div>
  </article>
}

export function MyLearningPage({ user }: { user: User }) {
  const { t } = useI18n()
  const dashboard = useQuery({ queryKey: ['learning-summary'], queryFn: () => api<LearningDashboard>('me/learning/'), staleTime: 30000 })
  if (dashboard.isLoading) return <Loading label={t('Загрузка обучения…')}/>
  if (dashboard.error) return <><ErrorState error={dashboard.error}/><Button variant="secondary" onClick={() => void dashboard.refetch()}>{t('Повторить')}</Button></>
  if (!dashboard.data) return null
  const { resume_course: resume, completed_courses: completed, available_courses: available } = dashboard.data
  return <>
    <div className="page-heading-row"><div><span className="eyebrow">{user.learning_track?.title}</span><h1>{t('Моё обучение')}</h1><p>{t('Ваши курсы и место, где вы остановились.')}</p></div><Link className="text-link" to="/catalog">{t('Смотреть весь каталог')}<ChevronRight size={16}/></Link></div>
    {resume ? <section className="resume-course card" aria-labelledby="resume-title"><div className="resume-course-copy"><span className="eyebrow">{t('Продолжить обучение')}</span><h2 id="resume-title">{resume.title}</h2><p>{resume.learning_track_title}</p><CourseProgressIndicator percent={resume.percent} completed={resume.completed_items} total={resume.total_items} label="Ваш прогресс"/>
      <div className="actions">{resume.resume_learning_item && <Link className="button primary" to={`/items/${resume.resume_learning_item.short_id}`}>{t('Продолжить обучение')}<ChevronRight size={17}/></Link>}</div></div>
      {resume.cover ? <img className="resume-course-cover" src={`/api/v1/media/${resume.cover}/`} alt=""/> : <BookOpen className="resume-course-art" size={72} aria-hidden="true"/>}
    </section> : <section className="empty-state"><BookOpen size={28}/><h2>{t(completed.length ? 'Все начатые курсы завершены' : 'Выберите первый курс и начните обучение')}</h2><p>{t(available.length ? 'Откройте доступный курс, чтобы начать.' : 'Новые доступные курсы появятся в каталоге.')}</p><Link className="button primary" to="/catalog">{t('Перейти в каталог')}</Link></section>}

    {completed.length > 0 && <section className="learning-dashboard-section"><h2>{t('Завершённые курсы')}</h2><div className="learning-course-grid">{completed.map(course => <CourseCard key={course.id} course={course}/>)}</div></section>}
    {available.length > 0 && <section className="learning-dashboard-section"><div className="section-heading"><h2>{t('Доступные курсы')}</h2><Link className="text-link" to="/catalog">{t('Смотреть весь каталог')}<ChevronRight size={16}/></Link></div><div className="learning-course-grid">{available.slice(0, 3).map(course => <CourseCard key={course.id} course={course}/>)}</div></section>}
  </>
}
