import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock3, Code2, Layers } from 'lucide-react'
import { api, apiAll, ApiError, type Attempt, type Block, type Course, type LearningItem, type Lesson, type Module, type Page, type Test, type Track, type User } from './api'
import { Button, ErrorState, Input, Loading, Notice, Select } from './components/ui'
import { LearningLayout, type CourseSection } from './layouts/LearningLayout'
import { RichLessonContent } from './components/LessonTextEditor'

function isTiptapContent(value: string) { try { return JSON.parse(value)?.type === 'doc' } catch { return false } }

export function CatalogPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['courses'], queryFn: () => apiAll<Course>('courses/') })
  return <><div className="page-heading-row"><div><span className="eyebrow">КАТАЛОГ ОБУЧЕНИЯ</span><h1>Мои курсы</h1><p>Материалы доступны в рамках выбранной траектории обучения.</p></div><span className="catalog-count">{data?.length ?? 0} {data?.length === 1 ? 'курс' : 'курсов'}</span></div>{isLoading ? <Loading/> : error ? <ErrorState error={error}/> : data?.length ? <div className="catalog-grid">{data.map((course, i) => <Link className="catalog-card" key={course.id} to={`/courses/${course.slug}`}><div className={`catalog-card-art tone-${i % 3}`}><Layers size={29}/><span>AI Edu · {String(i + 1).padStart(2, '0')}</span></div><div className="catalog-card-body"><span className="eyebrow">КУРС</span><h2>{course.title}</h2><p>{course.description || 'Уроки и тесты для системного обучения.'}</p><span className="card-link">Открыть курс <ChevronRight size={16}/></span></div></Link>)}</div> : <div className="empty-state"><Layers size={28}/><h2>Курсы пока не опубликованы</h2><p>Загляните позже — здесь появятся материалы по вашей траектории.</p></div>}</>
}

export function CoursePage() {
  const { slug } = useParams()
  const course = useQuery({ queryKey: ['course', slug], queryFn: () => api<Course>(`courses/${slug}/`) })
  const modules = useQuery({ queryKey: ['modules', course.data?.id], queryFn: () => apiAll<Module>(`modules/?course=${course.data!.id}`), enabled: Boolean(course.data) })
  const items = useQuery({ queryKey: ['course-items', course.data?.id, modules.data?.length], queryFn: async () => (await Promise.all((modules.data ?? []).map(module => apiAll<LearningItem>(`items/?module=${module.id}`)))).flat(), enabled: modules.isSuccess })
  if (course.isLoading || modules.isLoading || items.isLoading) return <Loading/>
  if (course.error || modules.error || items.error) return <ErrorState error={course.error || modules.error || items.error}/>
  return <><Link className="back" to="/catalog"><ArrowLeft size={16}/> Все курсы</Link><div className="page-heading-row"><div><span className="eyebrow">КУРС · {course.data?.learning_track ? 'ВАША ТРАЕКТОРИЯ' : 'ТРАЕКТОРИЯ'}</span><h1>{course.data?.title}</h1><p>{course.data?.description}</p></div><span className="catalog-count">{items.data?.length ?? 0} элементов</span></div><div className="module-list">{modules.data?.map((module, index) => <section className="module-card card" key={module.id}><div className="module-number">{String(index + 1).padStart(2, '0')}</div><div className="module-content"><div><span className="eyebrow">МОДУЛЬ {index + 1}</span><h2>{module.title}</h2><p>{module.description}</p></div><div className="module-lesson-list">{items.data?.filter(item => item.module === module.id).sort((a, b) => a.position - b.position).map(item => <Link to={`/items/${item.short_id}`} key={item.id}><span className="lesson-list-icon">{item.type === 'TEST' ? <CheckCircle2 size={17}/> : item.type === 'PRACTICE' ? <Code2 size={17}/> : <BookOpen size={17}/>}</span><span className="module-lesson-copy"><strong>{item.title}</strong><small>{item.type === 'LECTURE' ? 'Лекция' : item.type === 'TEST' ? 'Тест' : 'Практика'}</small></span><ChevronRight size={17}/></Link>)}</div></div></section>)}</div></>
}

function TestRunner({ lessonId, itemId }: { lessonId?: string; itemId?: string }) {
  const endpoint = itemId ? `items/${itemId}` : `lessons/${lessonId}`
  const key = itemId ?? lessonId
  const qc = useQueryClient()
  const { data: test, error } = useQuery({ queryKey: ['test', key], queryFn: () => api<Test>(`${endpoint}/test/`).catch(e => { if (e instanceof ApiError && e.status === 404) return null; throw e }) })
  const attempts = useQuery({ queryKey: ['attempts', key], queryFn: () => api<Page<Attempt>>(`${endpoint}/attempts/`).catch(() => null) })
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Attempt | null>(null)
  const [message, setMessage] = useState('')
  if (error || !test) return null
  const submit = async () => {
    setSubmitting(true); setMessage('')
    try {
      const attempt = await api<Attempt>(`${endpoint}/attempts/`, 'POST', { answers: test.questions.map(q => ({ question: q.id, option: answers[q.id!] })) })
      setResult(attempt); qc.invalidateQueries({ queryKey: ['attempts', key] })
    } catch (e) { setMessage((e as Error).message) } finally { setSubmitting(false) }
  }
  return <section className="test-section"><div className="section-heading"><div><span className="eyebrow">ПРОВЕРЬТЕ СЕБЯ</span><h2>{test.title}</h2><p>{test.description}</p></div><span className="pill">Проходной балл {test.passing_percent}%</span></div>{result ? <div className={`result-card ${result.passed ? 'passed' : 'failed'}`}><CheckCircle2 size={32}/><h3>{result.passed ? 'Тест пройден!' : 'Попробуйте ещё раз'}</h3><strong>{result.percent}%</strong><p>{result.earned_points} из {result.total_points} баллов</p></div> : <div className="stack">{test.questions.map((q, index) => <div key={q.id} className="card question-card"><span className="eyebrow">ВОПРОС {index + 1} · {q.points} БАЛЛ</span><h3>{q.text}</h3><div className="options">{q.options.map(o => <label key={o.id} className={answers[q.id!] === o.id ? 'selected' : ''}><input type="radio" name={`q-${q.id}`} checked={answers[q.id!] === o.id} onChange={() => setAnswers({ ...answers, [q.id!]: o.id! })}/>{o.text}</label>)}</div></div>)}<Notice text={message} kind="error"/><Button disabled={submitting || test.questions.some(q => !answers[q.id!])} onClick={submit}>Отправить ответы</Button></div>}{attempts.data && attempts.data.results.length > 0 && <div className="history"><h3>История попыток</h3>{attempts.data.results.map(a => <div key={a.id} className="history-row"><Clock3 size={16}/><span>{new Date(a.completed_at).toLocaleString('ru-RU')}</span><strong>{a.percent}%</strong><span className={a.passed ? 'good' : 'bad'}>{a.passed ? 'Пройдено' : 'Не пройдено'}</span></div>)}</div>}</section>
}

export function LessonPage() {
  const { id } = useParams()
  const lesson = useQuery({ queryKey: ['lesson', id], queryFn: () => api<Lesson>(`lessons/${id}/`) })
  const blocks = useQuery({ queryKey: ['blocks', id], queryFn: () => api<Block[]>(`lessons/${id}/blocks/`) })
  const modules = useQuery({ queryKey: ['learning-modules', lesson.data?.module], queryFn: () => apiAll<Module>('modules/'), enabled: Boolean(lesson.data) })
  const currentModule = modules.data?.find(module => module.id === lesson.data?.module)
  const course = useQuery({ queryKey: ['learning-course', currentModule?.course], queryFn: async () => {
    const courses = await apiAll<Course>('courses/')
    return courses.find(item => item.id === currentModule?.course) ?? null
  }, enabled: Boolean(currentModule) })
  const courseSectionsQuery = useQuery({ queryKey: ['learning-lessons', currentModule?.course, modules.data?.length], queryFn: async () => {
    const courseModules = (modules.data ?? []).filter(module => module.course === currentModule?.course)
    const grouped = await Promise.all(courseModules.map(async module => ({ module, lessons: await apiAll<Lesson>(`lessons/?module=${module.id}`) })))
    return grouped
  }, enabled: Boolean(currentModule) })
  if (lesson.isLoading || blocks.isLoading) return <Loading/>
  if (lesson.error || blocks.error) return <ErrorState error={lesson.error || blocks.error}/>
  const sections: CourseSection[] = (courseSectionsQuery.data ?? []).map(section => ({ ...section, lessons: section.lessons }))
  const courseLessons = sections.flatMap(section => section.lessons)
  const currentIndex = courseLessons.findIndex(item => item.short_id === id)
  return <LearningLayout courseTitle={course.data?.title} sections={sections} lessonId={id!} lessonTitle={lesson.data?.title || 'Урок'} currentIndex={currentIndex >= 0 ? currentIndex : 0} totalLessons={courseLessons.length || undefined} previous={currentIndex > 0 ? courseLessons[currentIndex - 1] : undefined} next={currentIndex >= 0 && currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : undefined}>
    <div className="lesson-heading"><span className="eyebrow">УЧЕБНЫЙ МАТЕРИАЛ</span><h1>{lesson.data?.title}</h1><p>{lesson.data?.description}</p></div>
    <article className="article lesson-article">{blocks.data?.map(block => block.type === 'TEXT' ? <div key={block.id} className="markdown">{isTiptapContent(block.content) ? <RichLessonContent value={block.content}/> : <ReactMarkdown skipHtml>{block.content}</ReactMarkdown>}</div> : <figure key={block.id}><img className={block.config?.width === 'reading' ? 'lesson-image-reading' : ''} src={block.media_url || ''} alt={block.content || 'Изображение урока'}/>{block.content && <figcaption>{block.content}</figcaption>}</figure>)}</article>
    <TestRunner lessonId={id!}/>
  </LearningLayout>
}

export function LearningItemPage() {
  const { id = '' } = useParams()
  const item = useQuery({ queryKey: ['learning-item', id], queryFn: () => api<LearningItem>(`items/${id}/`) })
  const blocks = useQuery({ queryKey: ['item-blocks', item.data?.lesson_short_id], queryFn: () => api<Block[]>(`lessons/${item.data!.lesson_short_id}/blocks/`), enabled: item.data?.type === 'LECTURE' && Boolean(item.data.lesson_short_id) })
  const modules = useQuery({ queryKey: ['learning-modules'], queryFn: () => apiAll<Module>('modules/'), enabled: Boolean(item.data) })
  const currentModule = modules.data?.find(module => module.id === item.data?.module)
  const course = useQuery({ queryKey: ['learning-course', currentModule?.course], queryFn: async () => (await apiAll<Course>('courses/')).find(entry => entry.id === currentModule?.course) ?? null, enabled: Boolean(currentModule) })
  const sectionsQuery = useQuery({ queryKey: ['learning-items', currentModule?.course], queryFn: async () => {
    const courseModules = [...(modules.data ?? []).filter(module => module.course === currentModule?.course)].sort((a, b) => a.position - b.position || a.id - b.id)
    return Promise.all(courseModules.map(async module => ({ module, lessons: (await apiAll<LearningItem>(`items/?module=${module.id}`)).sort((a, b) => a.position - b.position || a.id - b.id) })))
  }, enabled: Boolean(currentModule) })
  if (item.isLoading || blocks.isLoading || modules.isLoading || course.isLoading || sectionsQuery.isLoading) return <Loading/>
  if (item.error || blocks.error || modules.error || course.error || sectionsQuery.error) return <ErrorState error={item.error || blocks.error || modules.error || course.error || sectionsQuery.error}/>
  const sections: CourseSection[] = sectionsQuery.data ?? []
  const entries = sections.flatMap(section => section.lessons)
  const index = entries.findIndex(entry => entry.short_id === id)
  const kind = item.data?.type === 'TEST' ? 'ТЕСТ' : item.data?.type === 'PRACTICE' ? 'ПРАКТИКА' : 'ЛЕКЦИЯ'
  return <LearningLayout courseTitle={course.data?.title} sections={sections} lessonId={id} lessonTitle={item.data?.title || 'Материал'} currentIndex={Math.max(index, 0)} totalLessons={entries.length || undefined} previous={index > 0 ? entries[index - 1] : undefined} next={index >= 0 ? entries[index + 1] : undefined}>
    <div className="lesson-heading"><span className="eyebrow">{kind}</span><h1>{item.data?.title}</h1><p>{item.data?.description}</p></div>
    {item.data?.type === 'LECTURE' && <article className="article lesson-article">{blocks.data?.map(block => block.type === 'TEXT' ? <div key={block.id} className="markdown" style={{ textAlign: block.config?.align === 'center' || block.config?.align === 'right' ? block.config.align : 'left' }}>{isTiptapContent(block.content) ? <RichLessonContent value={block.content}/> : <ReactMarkdown skipHtml>{block.content}</ReactMarkdown>}</div> : <figure key={block.id}><img className={block.config?.width === 'reading' ? 'lesson-image-reading' : ''} src={block.media_url || ''} alt={String(block.config?.alt || block.content || 'Изображение лекции')}/>{block.content && <figcaption>{block.content}</figcaption>}</figure>)}</article>}
    {item.data?.type === 'TEST' && <TestRunner itemId={id}/>}
    {item.data?.type === 'PRACTICE' && <div className="card form-card"><h2>Практическая работа</h2><p>Интерактивное выполнение этой практики скоро появится.</p></div>}
  </LearningLayout>
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
  const tracks = useQuery({ queryKey: ['profile-tracks'], queryFn: () => apiAll<Track>('tracks/') })
  const [first, setFirst] = useState(user.first_name), [last, setLast] = useState(user.last_name), [selectedTrack, setSelectedTrack] = useState(String(user.learning_track?.id ?? '')), [message, setMessage] = useState('')
  const save = async () => { try { const u = await api<User>('auth/me/', 'PATCH', { first_name: first, last_name: last, learning_track: selectedTrack ? Number(selectedTrack) : null }); qc.setQueryData(['me'], u); qc.invalidateQueries({ queryKey: ['courses'] }); setMessage('Профиль сохранён') } catch (e) { setMessage((e as Error).message) } }
  return <><div className="page-head"><div><span className="eyebrow">ЛИЧНЫЕ ДАННЫЕ</span><h1>Профиль</h1><p>Управляйте личной информацией и смотрите результаты.</p></div></div><div className="card profile-card"><div className="avatar large">{(user.first_name || user.email)[0].toUpperCase()}</div><div><strong>{user.email}</strong><p>Траектория: {user.learning_track?.title ?? 'не выбрана'}</p>{user.date_joined && <p>С нами с {new Date(user.date_joined).toLocaleDateString('ru-RU')}</p>}</div></div><div className="card form-card"><h3>Личные данные</h3><div className="row"><label>Имя<Input value={first} onChange={e => setFirst(e.target.value)}/></label><label>Фамилия<Input value={last} onChange={e => setLast(e.target.value)}/></label></div><label>Траектория обучения<Select value={selectedTrack} onChange={e => setSelectedTrack(e.target.value)}><option value="">Не выбрана</option>{tracks.data?.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</Select></label><Button onClick={save}>Сохранить</Button><Notice text={message}/></div><PasswordSection/><h2 className="section-title">Результаты тестов</h2>{attempts.isLoading ? <Loading/> : attempts.error ? <ErrorState error={attempts.error}/> : <div className="card">{attempts.data?.results.length ? attempts.data.results.map(a => <div key={a.id} className="history-row"><Clock3 size={16}/><span>{new Date(a.completed_at).toLocaleString('ru-RU')}</span><strong>{a.percent}%</strong><span className={a.passed ? 'good' : 'bad'}>{a.passed ? 'Пройдено' : 'Не пройдено'}</span></div>) : <p>Попыток пока нет.</p>}</div>}</>
}
