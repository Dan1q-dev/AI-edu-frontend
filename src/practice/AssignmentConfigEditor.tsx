import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Bold, Italic, List, ListOrdered, Plus, Table2, Trash2 } from 'lucide-react'
import { Input, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import { blocksToDocument, documentToBlocks } from '../lecture/document'
import { TableCellBackground } from '../lecture/table'
import type { ConfigEditorProps } from './types'
import type { AssignmentConfig } from './GuidedAssignment'
import { api, type LessonAttachment } from '../api'
import { LessonAttachments } from '../components/LessonAttachments'
import { ATTACHMENT_ACCEPT, validateUploadSize } from '../utils/upload'

export function AssignmentConfigEditor({ config, disabled, onChange, onUploadingChange }: ConfigEditorProps) {
  const { t } = useI18n()
  const value = config as AssignmentConfig
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  async function uploadFiles(files: File[]) {
    setError('')
    setUploading(true)
    onUploadingChange?.(true)
    try {
      if ((latest.current.value.source_files?.length ?? 0) + files.length > 20) throw new Error(t('Можно добавить не более 20 файлов.'))
      files.forEach(validateUploadSize)
      for (const file of files) {
        const form = new FormData(); form.append('file', file)
        const uploaded = await api<LessonAttachment>('media/files/', 'POST', form)
        const current = latest.current.value
        const next = { ...current, source_url: '', source_files: [...(current.source_files ?? []), uploaded] }
        latest.current.value = next
        latest.current.onChange(next)
      }
    } catch (cause) { setError((cause as Error).message) }
    finally { setUploading(false); onUploadingChange?.(false) }
  }
  const editor = useEditor({
    extensions: [StarterKit, TableKit, TableCellBackground, TextStyle, Color, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ['paragraph', 'heading'] })],
    content: blocksToDocument(value.instructions.map((content, position) => ({ type: 'TEXT', position, content, media: null, config: {} }))),
    editable: !disabled,
    editorProps: { attributes: { 'aria-label': t('Инструкция к заданию'), role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: instance }) => {
      const instructions = documentToBlocks(instance.getJSON()).map(block => block.content)
      onChange({ ...value, instructions })
    },
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  const toolbar = [
    { Icon: Bold, label: 'Полужирный', action: () => editor?.chain().focus().toggleBold().run() },
    { Icon: Italic, label: 'Курсив', action: () => editor?.chain().focus().toggleItalic().run() },
    { Icon: List, label: 'Маркированный список', action: () => editor?.chain().focus().toggleBulletList().run() },
    { Icon: ListOrdered, label: 'Нумерованный список', action: () => editor?.chain().focus().toggleOrderedList().run() },
    { Icon: Table2, label: 'Вставить таблицу', action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  ]
  return <fieldset disabled={disabled} className="practice-config"><legend>{t('Инструкция к заданию')}</legend>
    <div className="assignment-editor"><div className="assignment-editor-toolbar">{toolbar.map(({ Icon, label, action }) => <button type="button" key={label} title={t(label)} aria-label={t(label)} onClick={action}><Icon size={17}/></button>)}</div><EditorContent editor={editor}/></div>
    <label>{t('Исходный документ')}<Input type="file" multiple accept={ATTACHMENT_ACCEPT} disabled={uploading || (value.source_files?.length ?? 0) >= 20} onChange={event => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ''; if (files.length) void uploadFiles(files) }}/></label>
    <small>{t(uploading ? 'Загрузка файлов…' : 'PDF, Word, PowerPoint, Excel, TXT, CSV или ZIP · до 10 МБ на файл.')}</small>
    {error && <p role="alert" className="notice error">{error}</p>}
    <LessonAttachments attachments={value.source_files ?? []} onRemove={disabled || uploading ? undefined : media => onChange({ ...value, source_files: value.source_files?.filter(file => file.media !== media) })}/>
    <div className="practice-criteria-heading"><h3>{t('Критерии самопроверки')}</h3><p>{t('Что студент должен проверить перед отправкой? Один пункт — одно понятное действие.')}</p></div>
    {value.criteria.map((criterion, index) => <div className="practice-criterion-editor" key={index}>
      <div className="practice-criterion-main"><label>{t('Критерий')} {index + 1}<Input value={criterion.title} placeholder={t('Например: в работе есть примеры по теме')} maxLength={300} onChange={event => onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, title: event.target.value } : row) })}/></label>
      <button type="button" className="button secondary" title={t('Удалить критерий')} aria-label={`${t('Удалить критерий')} ${index + 1}`} disabled={value.criteria.length <= 1} onClick={() => onChange({ ...value, criteria: value.criteria.filter((_, i) => i !== index) })}><Trash2 size={17}/></button></div>
      <details className="practice-criterion-details"><summary>{t('Пояснение и обязательность')}<small>{t(criterion.is_required ? 'Обязательный критерий' : 'Необязательный критерий')}</small></summary>
      <label>{t('Описание критерия')}<Textarea value={criterion.description} maxLength={2000} rows={2} onChange={event => onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, description: event.target.value } : row) })}/></label>
      <label><input type="checkbox" checked={criterion.is_required} onChange={event => onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, is_required: event.target.checked } : row) })}/>{t('Обязательный критерий')}</label>
      </details>
    </div>)}
    <button type="button" className="button secondary" disabled={value.criteria.length >= 30} onClick={() => onChange({ ...value, criteria: [...value.criteria, { title: '', description: '', is_required: true }] })}><Plus size={17}/>{t('Добавить критерий')}</button>
  </fieldset>
}
