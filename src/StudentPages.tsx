import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock3, Layers } from 'lucide-react'
import { api, ApiError, type Attempt, type Block, type Lesson, type Module, type Page, type Test, type Track, type User } from './api'
import { Button, ErrorState, Input, Loading, Notice } from './App'

export function CatalogPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['tracks'], queryFn: () => api<Page<Track>>('tracks/') })
  return <><div className="page-head"><div><span className="eyebrow">ИССЛЕДУЙТЕ И УЧИТЕСЬ</span><h1>Каталог траекторий</h1><p>Выберите направление, которое вам интересно.</p></div></div>{isLoading ? <Loading/> : error ? <ErrorState error={error}/> : <div className="grid two">{data?.results.map((track, i) => <Link className="card track-card" key={track.id} to={`/tracks/${track.short_id}`}><div className={`track-icon tone-${i % 2}`}><Layers size={30}/></div><span className="eyebrow">ОБРАЗОВАТЕЛЬНАЯ ТРАЕКТОРИЯ</span><h3>{track.title}</h3><p>{track.description || 'Уроки и тесты для системного обучения.'}</p><span className="text-link">Смотреть модули <ChevronRight size={16}/></span></Link>)}</div>}</>
}

export function TrackPage() {
  const { id } = useParams()
  const track = useQuery({ queryKey: ['track', id], queryFn: () => api<Track>(`tracks/${id}/`) })
  const modules = useQuery({ queryKey: ['modules', track.data?.id], queryFn: () => api<Page<Module>>(`modules/?track=${track.data!.id}`), enabled: Boolean(track.data) })
  const lessons = useQuery({ queryKey: ['all-lessons', id], queryFn: () => api<Page<Lesson>>('lessons/?page_size=100') })
  if (track.isLoading || modules.isLoading || lessons.isLoading) return <Loading/>
  if (track.error || modules.error || lessons.error) return <ErrorState error={track.error || modules.error || lessons.error}/>
  return <><Link className="back" to="/catalog"><ArrowLeft size={16}/> Все траектории</Link><div className="page-head"><div><span className="eyebrow">ПРОГРАММА ОБУЧЕНИЯ</span><h1>{track.data?.title}</h1><p>{track.data?.description}</p></div></div><div className="stack">{modules.data?.results.map((module, index) => <div className="card module-card" key={module.id}><div className="module-num">{String(index + 1).padStart(2, '0')}</div><div className="module-body"><h3>{module.title}</h3><p>{module.description}</p><div className="lesson-list">{lessons.data?.results.filter(l => l.module === module.id).map((lesson, i) => <Link to={`/lessons/${lesson.short_id}`} key={lesson.id}><BookOpen size={17}/><span>Урок {i + 1}. {lesson.title}</span><ChevronRight size={16}/></Link>)}</div></div></div>)}</div></>
}

function TestRunner({ lessonId }: { lessonId: string }) {
  const qc = useQueryClient()
  const { data: test, error } = useQuery({ queryKey: ['test', lessonId], queryFn: () => api<Test>(`lessons/${lessonId}/test/`).catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e }) })
  const attempts = useQuery({ queryKey: ['attempts', lessonId], queryFn: () => api<Page<Attempt>>(`lessons/${lessonId}/attempts/`).catch(() => null) })
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Attempt | null>(null)
  const [message, setMessage] = useState('')
  if (error || !test) return null
  const submit = async () => {
    setSubmitting(true); setMessage('')
    try {
      const attempt = await api<Attempt>(`lessons/${lessonId}/attempts/`, 'POST', { answers: test.questions.map(q => ({ question: q.id, option: answers[q.id!] })) })
      setResult(attempt); qc.invalidateQueries({ queryKey: ['attempts', lessonId] })
    } catch (e) { setMessage((e as Error).message) } finally { setSubmitting(false) }
  }
  return <section className="test-section"><div className="section-heading"><div><span className="eyebrow">ПРОВЕРЬТЕ СЕБЯ</span><h2>{test.title}</h2><p>{test.description}</p></div><span className="pill">Проходной балл {test.passing_percent}%</span></div>{result ? <div className={`result-card ${result.passed ? 'passed' : 'failed'}`}><CheckCircle2 size={32}/><h3>{result.passed ? 'Тест пройден!' : 'Попробуйте ещё раз'}</h3><strong>{result.percent}%</strong><p>{result.earned_points} из {result.total_points} баллов</p></div> : <div className="stack">{test.questions.map((q, index) => <div key={q.id} className="card question-card"><span className="eyebrow">ВОПРОС {index + 1} · {q.points} БАЛЛ</span><h3>{q.text}</h3><div className="options">{q.options.map(o => <label key={o.id} className={answers[q.id!] === o.id ? 'selected' : ''}><input type="radio" name={`q-${q.id}`} checked={answers[q.id!] === o.id} onChange={() => setAnswers({ ...answers, [q.id!]: o.id! })}/>{o.text}</label>)}</div></div>)}<Notice text={message} kind="error"/><Button disabled={submitting || test.questions.some(q => !answers[q.id!])} onClick={submit}>Отправить ответы</Button></div>}{attempts.data && attempts.data.results.length > 0 && <div className="history"><h3>История попыток</h3>{attempts.data.results.map(a => <div key={a.id} className="history-row"><Clock3 size={16}/><span>{new Date(a.completed_at).toLocaleString('ru-RU')}</span><strong>{a.percent}%</strong><span className={a.passed ? 'good' : 'bad'}>{a.passed ? 'Пройдено' : 'Не пройдено'}</span></div>)}</div>}</section>
}

export function LessonPage() {
  const { id } = useParams()
  const lesson = useQuery({ queryKey: ['lesson', id], queryFn: () => api<Lesson>(`lessons/${id}/`) })
  const blocks = useQuery({ queryKey: ['blocks', id], queryFn: () => api<Block[]>(`lessons/${id}/blocks/`) })
  if (lesson.isLoading || blocks.isLoading) return <Loading/>
  if (lesson.error || blocks.error) return <ErrorState error={lesson.error || blocks.error}/>
  return <><Link className="back" to="/catalog"><ArrowLeft size={16}/> К каталогу</Link><div className="lesson-header"><span className="eyebrow">УЧЕБНЫЙ МАТЕРИАЛ</span><h1>{lesson.data?.title}</h1><p>{lesson.data?.description}</p></div><article className="article">{blocks.data?.map(block => block.type === 'TEXT' ? <div key={block.id} className="markdown"><ReactMarkdown skipHtml>{block.content}</ReactMarkdown></div> : <figure key={block.id}><img src={block.media_url || ''} alt={block.content || 'Изображение урока'}/>{block.content && <figcaption>{block.content}</figcaption>}</figure>)}</article><TestRunner lessonId={id!}/></>
}

function PasswordSection() {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [message, setMessage] = useState('')
  const save = async () => {
    try {
      await api('auth/password/', 'POST', { current_password: current, new_password: next })
      setCurrent(''); setNext(''); setMessage('Пароль изменён')
    } catch (e) { setMessage((e as Error).message) }
  }
  return <div className="card form-card"><h3>Изменить пароль</h3><div className="row"><label>Текущий пароль<Input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}/></label><label>Новый пароль<Input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)}/></label></div><Button disabled={!current || next.length < 8} onClick={save}>Обновить пароль</Button><Notice text={message} kind={message === 'Пароль изменён' ? 'success' : 'error'}/></div>
}

export function ProfilePage({ user }: { user: User }) {
  const qc = useQueryClient()
  const attempts = useQuery({ queryKey: ['attempts-all'], queryFn: () => api<Page<Attempt>>('attempts/') })
  const [first, setFirst] = useState(user.first_name), [last, setLast] = useState(user.last_name), [message, setMessage] = useState('')
  const save = async () => { try { const u = await api<User>('auth/me/', 'PATCH', { first_name: first, last_name: last }); qc.setQueryData(['me'], u); setMessage('Профиль сохранён') } catch (e) { setMessage((e as Error).message) } }
  return <><div className="page-head"><div><span className="eyebrow">ЛИЧНЫЕ ДАННЫЕ</span><h1>Профиль</h1><p>Управляйте личной информацией и смотрите результаты.</p></div></div><div className="card profile-card"><div className="avatar large">{(user.first_name || user.email)[0].toUpperCase()}</div><div><strong>{user.email}</strong>{user.date_joined && <p>С нами с {new Date(user.date_joined).toLocaleDateString('ru-RU')}</p>}</div></div><div className="card form-card"><h3>Личные данные</h3><div className="row"><label>Имя<Input value={first} onChange={e => setFirst(e.target.value)}/></label><label>Фамилия<Input value={last} onChange={e => setLast(e.target.value)}/></label></div><Button onClick={save}>Сохранить</Button><Notice text={message}/></div><PasswordSection/><h2 className="section-title">Результаты тестов</h2>{attempts.isLoading ? <Loading/> : attempts.error ? <ErrorState error={attempts.error}/> : <div className="card">{attempts.data?.results.length ? attempts.data.results.map(a => <div key={a.id} className="history-row"><Clock3 size={16}/><span>{new Date(a.completed_at).toLocaleString('ru-RU')}</span><strong>{a.percent}%</strong><span className={a.passed ? 'good' : 'bad'}>{a.passed ? 'Пройдено' : 'Не пройдено'}</span></div>) : <p>Попыток пока нет.</p>}</div>}</>
}
