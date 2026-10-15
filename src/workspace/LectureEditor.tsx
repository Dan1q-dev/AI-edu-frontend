import { useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Eye, Pencil, Save } from 'lucide-react'
import { Button, Input, Select } from '../components/ui'
import { LessonTextEditor } from '../components/LessonTextEditor'
import { RichLessonContent } from '../components/RichLessonContent'
import { useI18n } from '../i18n'
import { sectionIds, type Lecture } from './types'

export function LectureEditor({ content, onChange, onSave, dirty, disabled, readOnly, saving, conflict }: {
  content: Lecture | null; onChange: (value: Lecture) => void; onSave: () => void
  dirty: boolean; disabled: boolean; readOnly: boolean; saving: boolean; conflict: boolean
}) {
  const { t } = useI18n()
  const [sectionId, setSectionId] = useState<typeof sectionIds[number]>('goal')
  const [preview, setPreview] = useState(false)
  const index = content?.sections.findIndex(section => section.id === sectionId) ?? 0
  const section = content?.sections[Math.max(0, index)]
  const update = (patch: Partial<NonNullable<typeof section>>) => {
    if (content && section) onChange({ ...content, sections: content.sections.map(row => row.id === section.id ? { ...row, ...patch } : row) })
  }
  return <section className="workspace-editor" aria-label={t('Редактор лекции')}>
    <header className="workspace-panel-heading"><div><BookOpen size={20}/><h2>{t('Редактор лекции')}</h2></div>
      <div className="workspace-editor-actions"><span className={`workspace-save-state ${dirty ? 'dirty' : ''}`} role="status">{t(saving ? 'Сохранение…' : dirty ? 'Есть несохранённые изменения' : 'Сохранено')}</span>
        {content && !readOnly && <Button variant="secondary" disabled={saving} onClick={() => setPreview(!preview)}>{preview ? <Pencil size={16}/> : <Eye size={16}/>} {t(preview ? 'Редактировать' : 'Просмотр')}</Button>}
        {!readOnly && <Button disabled={!content || !dirty || disabled || conflict} onClick={onSave}><Save size={16}/>{t('Сохранить лекцию')}</Button>}</div>
    </header>
    {!content ? <div className="workspace-editor-empty"><BookOpen size={36}/><h3>{t('Ваша лекция появится здесь')}</h3><p>{t('Заполните параметры и сгенерируйте первый вариант лекции.')}</p></div> : <>
      <div className="workspace-document-title">{readOnly || preview ? <h2>{content.title}</h2> : <label>{t('Название лекции')}<Input maxLength={300} disabled={disabled} value={content.title} onChange={event => onChange({ ...content, title: event.target.value })}/></label>}</div>
      {preview ? <article className="workspace-preview">{content.sections.map(row => <section key={row.id}><h3>{row.title}</h3><RichLessonContent value={JSON.stringify(row.content)}/></section>)}</article> : <>
        <nav className="workspace-section-tabs" aria-label={t('Разделы лекции')}>{content.sections.map((row, offset) => <button type="button" key={row.id} aria-current={row.id === sectionId ? 'step' : undefined} onClick={() => setSectionId(row.id)}><span>{String(offset + 1).padStart(2, '0')}</span>{row.title}</button>)}</nav>
        <label className="workspace-section-select">{t('Раздел лекции')}<Select value={sectionId} onChange={event => setSectionId(event.target.value as typeof sectionId)}>{content.sections.map((row, offset) => <option key={row.id} value={row.id}>{offset + 1}. {row.title}</option>)}</Select></label>
        {section && <div className="workspace-section-content">
          {readOnly ? <><h3>{section.title}</h3><RichLessonContent value={JSON.stringify(section.content)}/></> : <>
            <label>{t('Название раздела')}<Input maxLength={200} disabled={disabled} value={section.title} onChange={event => update({ title: event.target.value })}/></label>
            <LessonTextEditor key={section.id} lectureMode value={JSON.stringify(section.content)} disabled={disabled} onChange={value => update({ content: JSON.parse(value) })}/>
          </>}
          <div className="workspace-section-navigation"><Button variant="secondary" disabled={index <= 0} onClick={() => setSectionId(content.sections[index - 1]!.id)}><ChevronLeft size={16}/>{t('Предыдущий раздел')}</Button>
            <span>{index + 1} {t('из')} {content.sections.length}</span><Button variant="secondary" disabled={index >= content.sections.length - 1} onClick={() => setSectionId(content.sections[index + 1]!.id)}>{t('Следующий раздел')}<ChevronRight size={16}/></Button></div>
        </div>}
      </>}
    </>}
  </section>
}
