import { useState, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, Check, CheckCircle2, Code2, List, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LearningItem, Lesson, Module } from '../api'

type ContentEntry = Lesson | LearningItem
const entryHref = (item: ContentEntry) => 'type' in item ? `/items/${item.short_id}` : `/lessons/${item.short_id}`
const entryIcon = (item: ContentEntry) => 'type' in item && item.type === 'TEST' ? <CheckCircle2 size={16}/> : 'type' in item && item.type === 'PRACTICE' ? <Code2 size={16}/> : <BookOpen size={16}/>
export type CourseSection = { module: Module; lessons: ContentEntry[] }

export function LearningLayout({
  children, courseTitle, sections, lessonId, lessonTitle, currentIndex, totalLessons, previous, next,
}: {
  children: ReactNode
  courseTitle?: string
  sections?: CourseSection[]
  lessonId: string
  lessonTitle: string
  currentIndex?: number
  totalLessons?: number
  previous?: ContentEntry
  next?: ContentEntry
}) {
  const [outlineOpen, setOutlineOpen] = useState(false)
  const progress = totalLessons ? Math.round(((currentIndex || 0) + 1) / totalLessons * 100) : 0

  return <div className="learning-layout">
    <header className="learning-header">
      <Link to="/catalog" className="learning-back" aria-label="Вернуться в каталог"><ArrowLeft size={18}/><span>Каталог</span></Link>
      <div className="learning-header-title"><span>{courseTitle || 'Моё обучение'}</span><strong>{lessonTitle}</strong></div>
      <button className="button secondary outline-button" onClick={() => setOutlineOpen(true)} aria-expanded={outlineOpen} aria-controls="course-outline"><List size={17}/>Оглавление</button>
    </header>
    <div className="learning-progress" aria-label={`Прогресс: ${progress}%`}><span style={{ width: `${progress}%` }}/></div>
    <div className="learning-crumbs"><Link to="/catalog">Каталог</Link>{courseTitle && <><span>/</span><span>{courseTitle}</span></>}<span>/</span><strong>{lessonTitle}</strong></div>
    <main className="learning-main">{children}</main>
    <footer className="lesson-navigation">
      {previous ? <Link className="button secondary" to={entryHref(previous)} aria-label={`Предыдущий элемент: ${previous.title}`}><ArrowLeft size={16}/><span><small>Предыдущий элемент</small>{previous.title}</span></Link> : <span/>}
      <span className="lesson-counter">{totalLessons ? `${(currentIndex || 0) + 1} из ${totalLessons}` : 'Элемент'}</span>
      {next ? <Link className="button primary" to={entryHref(next)} aria-label={`Следующий элемент: ${next.title}`}><span><small>Следующий элемент</small>{next.title}</span><ArrowLeft className="next-arrow" size={16}/></Link> : <span className="course-end"><Check size={16}/>Последний элемент</span>}
    </footer>
    {outlineOpen && <div className="outline-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOutlineOpen(false) }}>
      <aside id="course-outline" className="course-outline" aria-label="Оглавление курса">
        <div className="outline-header"><div><span className="eyebrow">СОДЕРЖАНИЕ КУРСА</span><h2>{courseTitle || 'Оглавление'}</h2></div><button className="icon-button" onClick={() => setOutlineOpen(false)} aria-label="Закрыть оглавление"><X size={20}/></button></div>
        {totalLessons ? <div className="outline-progress"><div><span>Ваш прогресс</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div></div> : null}
        <div className="outline-scroll">{sections?.map(section => <section className="outline-section" key={section.module.id}>
          <h3>{section.module.title}</h3>
          {section.lessons.map(item => <Link key={item.id} to={entryHref(item)} onClick={() => setOutlineOpen(false)} className={`outline-lesson ${item.short_id === lessonId ? 'active' : ''}`} aria-current={item.short_id === lessonId ? 'page' : undefined}>{entryIcon(item)}<span>{item.title}</span>{item.short_id === lessonId && <span className="outline-active-label">Сейчас</span>}</Link>)}
        </section>)}</div>
      </aside>
    </div>}
  </div>
}
