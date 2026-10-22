import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Award, BookOpen, Check, ClipboardCheck, Download, Lock, QrCode } from 'lucide-react'
import { api, type CourseLearningSummary } from './api'
import { Button, ErrorState, Loading, Notice } from './components/ui'
import { useI18n } from './i18n'
import './program-journey.css'

export type Certificate = { token: string; number: string; learner_name: string; course_title: string; track_title: string; hours: number; issued_at: string; completed_at: string; revoked: boolean; download_url: string }
export type JourneyModule = { short_id: string; title: string; is_locked: boolean; is_completed: boolean; content_completed: boolean; completed_items: number; total_items: number; target_id: string | null; test_id: string | null; test_passed: boolean; last_score: number | null; passing_percent: number | null }
export type Journey = { course_id: string; title: string; track_title: string; enabled: boolean; hours: number; configured: boolean; completed_modules: number; total_modules: number; required_modules: number; can_issue: boolean; modules: JourneyModule[]; certificate: Certificate | null }

function hoursLabel(hours: number, locale: string) {
  return new Intl.NumberFormat(locale === 'kz' ? 'kk' : locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(hours)
}

export function primaryProgram(courses: CourseLearningSummary[]) {
  return courses.find(course => course.certificate_enabled && !course.is_completed) ?? courses.find(course => course.certificate_enabled)
}

export function CertificateResult({ certificate }: { certificate: Certificate }) {
  const { t, locale } = useI18n()
  const [showQR, setShowQR] = useState(false)
  return <div className="certificate-result">
    <div><span className="eyebrow">AI Edu</span><h2>{t(certificate.revoked ? 'Сертификат аннулирован' : 'Сертификат об окончании курса')}</h2>
      <strong>{certificate.learner_name}</strong><p>{certificate.course_title}</p><p>{certificate.track_title}</p>
      <p>{hoursLabel(certificate.hours, locale)} · {new Date(certificate.completed_at).toLocaleDateString('ru-RU')}</p>
      <small className="certificate-number">{certificate.number}</small></div>
    {!certificate.revoked && <div className="certificate-actions"><a className="button primary" href={certificate.download_url}><Download size={17}/>{t('Скачать PDF')}</a>
      <Button variant="secondary" onClick={() => setShowQR(value => !value)} aria-expanded={showQR}><QrCode size={18}/>{t('QR-код')}</Button>
      {showQR && <figure><img width="180" height="180" src={`/api/v1/certificates/${certificate.token}/qr/`} alt={t('QR-код сертификата')}/><figcaption>{t('Проверка подлинности и скачивание')}</figcaption></figure>}
    </div>}
  </div>
}

export function ProgramJourney({ courseId }: { courseId: string }) {
  const { t, locale } = useI18n()
  const client = useQueryClient()
  const [issuing, setIssuing] = useState(false), [error, setError] = useState('')
  const query = useQuery({ queryKey: ['program-journey', courseId], queryFn: () => api<Journey>(`courses/${courseId}/journey/`), staleTime: 0 })
  if (query.isLoading) return <Loading/>
  if (query.error) return <ErrorState error={query.error}/>
  const journey = query.data
  if (!journey) return null
  const issue = async () => {
    if (issuing) return
    setIssuing(true); setError('')
    try {
      await api<Certificate>(`courses/${courseId}/certificate/`, 'POST')
      await client.invalidateQueries({ queryKey: ['program-journey', courseId] })
    } catch (cause) { setError((cause as Error).message) }
    finally { setIssuing(false) }
  }
  return <div className="program-journey">
    <header className="program-heading"><div><span className="eyebrow">{journey.track_title}</span><h1>{journey.title}</h1>
      <p>{journey.completed_modules} / {journey.total_modules} {t('модулей завершено')} · {hoursLabel(journey.hours, locale)}</p></div>
      <Award size={34} aria-hidden="true"/></header>
    <ol className="program-timeline" aria-label={t('Путь обучения')}>{journey.modules.map((module, index) => <li key={module.short_id} className={`${module.is_completed ? 'is-complete' : ''} ${module.is_locked ? 'is-locked' : ''}`}>
      <span className="program-step" aria-hidden="true">{module.is_completed ? <Check size={20}/> : module.is_locked ? <Lock size={17}/> : index + 1}</span>
      <article className="program-module"><div className="program-module-top"><div><small>{t('Модуль')} {index + 1}</small><h2>{module.title}</h2></div>
        <span className="program-status">{t(module.is_completed ? 'Завершён' : module.is_locked ? 'Пока закрыт' : 'Доступен')}</span></div>
        <div className="program-stage"><BookOpen size={18}/><div><strong>{t('Лекции и практические')}</strong><small>{module.completed_items} / {module.total_items}</small></div>
          {!module.is_locked && module.target_id && <Link className="button secondary" to={`/items/${module.target_id}`}><span>{t(module.content_completed ? 'Повторить' : module.completed_items ? 'Продолжить' : 'Начать')}</span><ArrowRight size={16}/></Link>}</div>
        <div className="program-stage"><ClipboardCheck size={18}/><div><strong>{t('Тест после модуля')} {index + 1}</strong>
          <small>{module.test_passed ? t('Тест сдан') : module.last_score !== null ? `${t('Результат')}: ${module.last_score}%` : module.passing_percent !== null ? `${t('Проходной балл')}: ${module.passing_percent}%` : t('Тест готовится')}</small></div>
          {!module.is_locked && module.content_completed && module.test_id ? <Link className="button secondary" to={`/items/${module.test_id}`}>{t(module.test_passed ? 'Результаты' : 'Пройти тест')}<ArrowRight size={16}/></Link> : <Lock size={16} aria-label={t('Сначала завершите материалы модуля')}/>}</div>
      </article>
    </li>)}</ol>
    {!journey.modules.length && <p>{t('Учебная программа готовится. Материалы появятся здесь после публикации.')}</p>}
    <section className="program-certificate" aria-label={t('Завершение обучения')}><Award size={26}/><div><h2>{t('Завершение обучения')}</h2>
      {journey.certificate ? <CertificateResult certificate={journey.certificate}/> : <><p>{t('Сертификат на')} {hoursLabel(journey.hours, locale)}</p>
        <p>{t(journey.can_issue ? 'Все модули завершены. Сертификат готов к выдаче.' : 'Сертификат откроется после всех модулей и итоговых тестов.')}</p>
        <Button disabled={!journey.can_issue || issuing} onClick={() => void issue()}><Award size={17}/>{t(issuing ? 'Формирование…' : 'Получить сертификат')}</Button></>}
      <Notice text={error} onDismiss={() => setError('')} kind="error"/></div></section>
  </div>
}

export function CertificatePage() {
  const { token } = useParams()
  const { t } = useI18n()
  const query = useQuery({ queryKey: ['certificate', token], queryFn: () => api<Certificate>(`certificates/${token}/`), retry: false })
  return <main className="certificate-verification"><Link to="/" className="brand">AI Edu</Link>
    {query.isLoading ? <Loading/> : query.error ? <><h1>{t('Сертификат не найден')}</h1><p>{t('Проверьте ссылку или QR-код.')}</p></> : query.data && <><p className="eyebrow">{t(query.data.revoked ? 'Документ недействителен' : 'Подлинность подтверждена')}</p><CertificateResult certificate={query.data}/></>}
  </main>
}
