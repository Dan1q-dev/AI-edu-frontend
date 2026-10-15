import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, Check, CheckCircle2, Code2, List, LockKeyhole, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LearningItem, Lesson, Module, User } from '../api'
import { LanguageSelect, useI18n } from '../i18n'
import { AccountMenu } from './AccountMenu'
import { LearningStatus } from '../components/LearningStatus'

type ContentEntry = Lesson | LearningItem
export type ItemProgress = { progress_percent: number; is_completed: boolean; is_started?: boolean }
export type CourseSection = { module: Module; lessons: ContentEntry[] }
const entryHref = (item: ContentEntry) => 'type' in item ? `/items/${item.short_id}` : `/lessons/${item.short_id}`
const entryIcon = (item: ContentEntry) => 'type' in item && item.type === 'TEST' ? <CheckCircle2 size={15}/> : 'type' in item && item.type === 'PRACTICE' ? <Code2 size={15}/> : <BookOpen size={15}/>
const entryLocked = (item: ContentEntry) => Boolean(item.is_locked)

function AITutorPlaceholder() {
  const { t } = useI18n()
  return <><div className="tutor-icon"><Sparkles size={18}/></div><h2>{t('AI Tutor')}</h2><p>{t('Персональный помощник появится здесь позже.')}</p></>
}

export function LearningLayout({ children, tutor, workspace = false, courseTitle, courseSlug, user, moduleTitle, sections, lessonId, lessonTitle, currentIndex, totalLessons, previous, next, courseProgress, itemProgress = {} }: {
  user?: User; courseSlug?: string
  workspace?: boolean
  children: ReactNode; courseTitle?: string; moduleTitle?: string; sections?: CourseSection[]; lessonId: string; lessonTitle: string
  currentIndex?: number; totalLessons?: number; previous?: ContentEntry; next?: ContentEntry; tutor?: ReactNode
  courseProgress?: number; itemProgress?: Record<string, ItemProgress>
}) {
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const tutorDialog = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const { t } = useI18n()
  useEffect(() => { setOutlineOpen(false); setTutorOpen(false) }, [lessonId])
  useEffect(() => {
    if (!tutorOpen) return
    const returnFocus = document.activeElement as HTMLElement | null
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTutorOpen(false)
      if (event.key !== 'Tab') return
      const elements = [...(tutorDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href], input:not(:disabled), summary') ?? [])].filter(element => element.getClientRects().length)
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close); if (returnFocus?.isConnected) returnFocus.focus() }
  }, [tutorOpen])
  useEffect(() => {
    if (!outlineOpen) return
    const drawer = drawerRef.current
    const focusable = () => [...(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]') ?? [])]
    focusable()[0]?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOutlineOpen(false) }
      if (event.key === 'Tab') {
        const nodes = focusable(), first = nodes[0], last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', close)
    const onResize = () => { if (!workspace && window.innerWidth > 900) setOutlineOpen(false) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('resize', onResize); document.body.style.overflow = previousOverflow; triggerRef.current?.focus() }
  }, [outlineOpen, workspace])

  const outline = <>
    <div className="outline-header"><div><span className="eyebrow">{t('СОДЕРЖАНИЕ КУРСА')}</span><h2>{courseTitle || t('Оглавление')}</h2></div><button className="icon-button outline-close" onClick={() => setOutlineOpen(false)} aria-label={t('Закрыть оглавление')}><X size={19}/></button></div>
    {totalLessons ? <div className="outline-progress"><div><span>{t('Ваш прогресс')}</span><strong>{courseProgress ?? 0}%</strong></div><div className="progress-track"><span style={{ width: `${courseProgress ?? 0}%` }}/></div></div> : null}
    <div className="outline-scroll">{sections?.map((section, sectionIndex) => <section className="outline-section" key={section.module.id}>
      <h3>{t('МОДУЛЬ')} {sectionIndex + 1} · {section.module.title}</h3>
      {section.lessons.map(item => {
        const state = itemProgress[item.short_id]
        if (section.module.is_locked || entryLocked(item)) return <div key={item.id} className="outline-lesson is-locked" aria-disabled="true" title={t('Сначала завершите предыдущий модуль')}><LockKeyhole size={15}/><span className="outline-lesson-title">{item.title}</span></div>
        return <Link key={item.id} to={entryHref(item)} onClick={() => setOutlineOpen(false)} className={`outline-lesson ${item.short_id === lessonId ? 'active' : ''}`} aria-current={item.short_id === lessonId ? 'page' : undefined}>
          {entryIcon(item)}<span className="outline-lesson-title">{item.title}</span>{state?.progress_percent && !state.is_completed ? <small>{state.progress_percent}%</small> : <LearningStatus completed={state?.is_completed} started={state?.is_started}/>}
        </Link>
      })}
    </section>)}</div>
  </>

  return <div className={`learning-layout ${workspace ? 'is-document-workspace' : ''}`}>
    <header className="learning-header" inert={outlineOpen || tutorOpen}>
      <Link to={courseSlug ? `/courses/${courseSlug}` : '/catalog'} className="learning-back" aria-label={t(courseSlug ? 'Вернуться к курсу' : 'Вернуться в каталог')}><ArrowLeft size={17}/><span>{t(courseSlug ? 'К курсу' : 'Каталог')}</span></Link>
      <nav className="learning-header-title learning-breadcrumbs" aria-label={t('Путь обучения')}>{courseTitle && <Link to={courseSlug ? `/courses/${courseSlug}` : '/catalog'}>{courseTitle}</Link>}<span>{moduleTitle && <>{moduleTitle} <span aria-hidden="true">›</span> </>}<strong aria-current="page">{lessonTitle}</strong></span></nav>
      <div className="learning-header-tools"><LanguageSelect compact/>{tutor && !workspace && <button className="button secondary tutor-toggle" title={t('Открыть тьютора')} aria-label={t('Открыть тьютора')} aria-expanded={tutorOpen} onClick={() => setTutorOpen(true)}><Sparkles size={17}/><span>{t('Тьютор')}</span></button>}<button ref={triggerRef} className="button secondary outline-button" onClick={() => setOutlineOpen(true)} aria-label={t('Содержание')} aria-expanded={outlineOpen} aria-controls="course-outline"><List size={17}/><span>{t('Содержание')}</span></button>{user && <div className="workspace-account"><AccountMenu user={user}/></div>}</div>
    </header>
    <div className="learning-workspace" inert={outlineOpen || tutorOpen}>
      {!workspace && <aside className="course-outline desktop-outline" aria-label={t('Содержание курса')}>{outline}</aside>}
      <div className="learning-center"><main className="learning-main">{children}</main>
        <footer className="lesson-navigation">
          {previous ? <Link className="button secondary" to={entryHref(previous)} aria-label={`${t('Предыдущий элемент')}: ${previous.title}`}><ArrowLeft size={16}/><span><small>{t('Предыдущий')}</small>{previous.title}</span></Link> : <span/>}
          <span className="lesson-counter">{totalLessons ? `${(currentIndex || 0) + 1} ${t('из')} ${totalLessons}` : t('Элемент')}</span>
          {next ? entryLocked(next) ? <span className="course-end"><LockKeyhole size={16}/>{t('Сначала завершите текущий модуль')}</span> : <Link className="button secondary" to={entryHref(next)} aria-label={`${t('Следующий элемент')}: ${next.title}`}><span><small>{t('Следующий')}</small>{next.title}</span><ArrowLeft className="next-arrow" size={16}/></Link> : <span className="course-end"><Check size={16}/>{t('Последний элемент')}</span>}
        </footer>
      </div>
      {!workspace && !tutorOpen && <aside className="learning-tutor" aria-label={t('AI Tutor')}>{tutor ?? <AITutorPlaceholder/>}</aside>}
    </div>
    {outlineOpen && <div className="outline-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOutlineOpen(false) }}><aside ref={drawerRef} role="dialog" aria-modal="true" id="course-outline" className="course-outline mobile-outline" aria-label={t('Содержание курса')}>{outline}</aside></div>}
    {tutorOpen && <div ref={tutorDialog} className="tutor-overlay" role="dialog" aria-modal="true" aria-label={t('ИИ-тьютор')} onMouseDown={event => { if (event.target === event.currentTarget) setTutorOpen(false) }}><aside className="learning-tutor"><div className="tutor-mobile-close"><button autoFocus className="icon-button" title={t('Закрыть тьютора')} aria-label={t('Закрыть тьютора')} onClick={() => setTutorOpen(false)}><X size={19}/></button></div>{tutor}</aside></div>}
  </div>
}
