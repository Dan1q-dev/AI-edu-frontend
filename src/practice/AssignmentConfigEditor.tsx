import { useEffect } from 'react'
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

export function AssignmentConfigEditor({ config, disabled, onChange }: ConfigEditorProps) {
  const { t } = useI18n()
  const value = config as AssignmentConfig
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
    <label>{t('Исходный документ')}<Input type="url" value={value.source_url ?? ''} onChange={event => onChange({ ...value, source_url: event.target.value })}/></label>
    <h3>{t('Критерии самопроверки')}</h3>
    {value.criteria.map((criterion, index) => <div className="practice-criterion-editor" key={index}>
      <label>{t('Критерий')} {index + 1}<Input value={criterion.title} maxLength={300} onChange={event => onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, title: event.target.value } : row) })}/></label>
      <label>{t('Описание критерия')}<Textarea value={criterion.description} maxLength={2000} onChange={event => onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, description: event.target.value } : row) })}/></label>
      <label><input type="checkbox" checked={criterion.is_required} onChange={event => onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, is_required: event.target.checked } : row) })}/>{t('Обязательный критерий')}</label>
      <button type="button" className="button secondary" title={t('Удалить критерий')} disabled={value.criteria.length <= 1} onClick={() => onChange({ ...value, criteria: value.criteria.filter((_, i) => i !== index) })}><Trash2 size={17}/>{t('Удалить')}</button>
    </div>)}
    <button type="button" className="button secondary" disabled={value.criteria.length >= 30} onClick={() => onChange({ ...value, criteria: [...value.criteria, { title: '', description: '', is_required: true }] })}><Plus size={17}/>{t('Добавить критерий')}</button>
  </fieldset>
}
