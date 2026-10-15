import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Attempt, type Page, type Test } from './api'
import { Button, ErrorState, Loading, Notice } from './components/ui'
import { AdaptiveResultCard } from './AdaptiveLearning'
import { useI18n } from './i18n'

export function TestRunner({ itemId }: { itemId: string }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const endpoint = `items/${itemId}`
  const testQuery = useQuery({ queryKey: ['test', itemId], queryFn: () => api<Test>(`${endpoint}/test/`).catch(error => { if (error instanceof ApiError && error.status === 404) return null; throw error }) })
  const attempts = useQuery({ queryKey: ['attempts', itemId], queryFn: () => api<Page<Attempt>>(`${endpoint}/attempts/`), enabled: Boolean(testQuery.data) })
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Attempt | null>(null)
  const [message, setMessage] = useState('')
  if (testQuery.isLoading) return <Loading label={t('Загрузка теста…')}/>
  if (testQuery.error) return <section className="test-section"><ErrorState error={new Error(t('Не удалось загрузить тест'))}/><Button variant="secondary" onClick={() => void testQuery.refetch()}>{t('Повторить')}</Button></section>
  const test = testQuery.data
  if (!test) return <section className="empty-state"><h2>{t('Тест пока недоступен')}</h2></section>
  const used = attempts.data?.count
  const remaining = used === undefined || test.max_attempts === null ? undefined : Math.max(0, test.max_attempts - used)
  const exhausted = remaining === 0
  const canRetry = (test.max_attempts === null || remaining !== undefined && remaining > 0) && (!result?.adaptive_result || result.adaptive_result.module_completed)
  const submit = async () => {
    if (submitting || exhausted) return
    setSubmitting(true); setMessage('')
    try {
      const attempt = await api<Attempt>(`${endpoint}/attempts/`, 'POST', { answers: test.questions.map(question => ({ question: question.id, option: answers[question.id!] })) })
      setResult(attempt)
      qc.setQueryData<Page<Attempt>>(['attempts', itemId], previous => previous ? { ...previous, count: previous.count + 1, results: [attempt, ...previous.results] } : previous)
      await Promise.all(['attempts', 'course-progress', 'learning-summary', 'learning-items', 'course-items', 'modules', 'attempts-all'].map(queryKey => qc.invalidateQueries({ queryKey: [queryKey] })))
    } catch (error) { setMessage((error as Error).message) } finally { setSubmitting(false) }
  }
  const retry = () => { setResult(null); setAnswers({}); setMessage('') }
  return <section className="test-section">
    <div className="section-heading"><div><span className="eyebrow">{t('ПРОВЕРЬТЕ СЕБЯ')}</span><h2>{test.title}</h2><p>{test.description}</p></div><span className="pill">{t('Проходной балл')} {test.passing_percent}%</span></div>
    <p className="attempt-count" aria-live="polite">{used !== undefined && <span>{t('Использовано попыток')}: {used}</span>}{remaining !== undefined && <span>{t('Осталось попыток')}: {remaining}</span>}{test.max_attempts === null && <span>{t('Количество попыток не ограничено')}</span>}</p>
    {attempts.error && <div className="history-notice"><Notice kind="error" text={t('Не удалось загрузить историю попыток. Ограничения проверяются сервером.')}/><Button variant="secondary" onClick={() => void attempts.refetch()}>{t('Повторить загрузку истории')}</Button></div>}
    {result ? <><div role="status" className={`result-card ${result.passed ? 'passed' : 'failed'}`}><CheckCircle2 size={32}/><h3>{t(result.adaptive_result ? 'Результат теста' : result.passed ? 'Тест пройден!' : 'Тест не пройден')}</h3><strong>{result.percent}%</strong><p>{result.earned_points} {t('из')} {result.total_points} {t('баллов')}</p>{result.adaptive_result && <p>{t(result.passed ? 'Пройдено' : 'Не пройдено')}</p>}{canRetry && <Button variant="secondary" disabled={submitting} onClick={retry}>{t('Пройти ещё раз')}</Button>}{exhausted && <p>{t('Лимит попыток исчерпан')}</p>}</div>{result.adaptive_result && <AdaptiveResultCard result={result.adaptive_result}/>}</> : exhausted ? <Notice kind="error" text={t('Лимит попыток исчерпан')}/> : <div className="stack">
      {test.questions.map((question, index) => <fieldset key={question.id} className="card question-card"><legend>{t('ВОПРОС')} {index + 1}</legend><h3>{question.text}</h3><div className="options">{question.options.map(option => <label key={option.id} className={answers[question.id!] === option.id ? 'selected' : ''}><input type="radio" name={`q-${question.id}`} checked={answers[question.id!] === option.id} onChange={() => setAnswers(current => ({ ...current, [question.id!]: option.id! }))}/>{option.text}</label>)}</div></fieldset>)}
      <Notice kind="error" text={message}/><Button disabled={submitting || !test.questions.length || test.questions.some(question => !answers[question.id!])} onClick={() => void submit()}>{t(submitting ? 'Отправка ответов…' : 'Отправить ответы')}</Button>
    </div>}
    {attempts.isLoading && <Loading variant="inline" label={t('Загрузка истории попыток…')}/>}
    {attempts.data?.results.length ? <div className="history"><h3>{t('История попыток')}</h3>{attempts.data.results.map(attempt => <div key={attempt.id} className="history-row"><Clock3 size={16}/><span>{new Date(attempt.completed_at).toLocaleString(locale === 'kz' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU')}</span><strong>{attempt.percent}%</strong><span className={attempt.passed ? 'good' : 'bad'}>{t(attempt.passed ? 'Пройдено' : 'Не пройдено')}</span>{attempt.adaptive_result && !attempt.adaptive_result.module_completed && <Link to={`/items/${attempt.adaptive_result.repeat_item_short_id}`}>{t('Повторить модуль')}</Link>}</div>)}</div> : null}
  </section>
}
