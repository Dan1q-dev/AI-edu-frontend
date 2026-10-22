import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import DragHandle from '@tiptap/extension-drag-handle-react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import Mathematics from '@tiptap/extension-mathematics'
import TextAlign from '@tiptap/extension-text-align'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { api, type Block } from '../api'
import { prepareImageForUpload } from '../utils/image'
import { useI18n } from '../i18n'
import { blocksToDocument, documentToBlocks } from './document'
import { videoSource } from './video'
import { Callout, LectureImage, LectureRoot, LectureVideo } from './nodes'
import { LectureRibbon } from './LectureRibbon'
import { LectureImportDialog } from './LectureImportDialog'
import { closeHistory } from '@tiptap/pm/history'
import { TableCellBackground } from './table'
import './lecture-document.css'

const options = [
  ['paragraph', 'Текст'], ['heading', 'Заголовок'], ['bullet', 'Маркированный список'], ['ordered', 'Нумерованный список'],
  ['image', 'Изображение'], ['table', 'Таблица'], ['important', 'Важно'], ['note', 'Примечание'], ['tip', 'Совет'],
  ['video', 'Видео'], ['rule', 'Разделитель'], ['math', 'Формула LaTeX'], ['quote', 'Цитата'], ['code', 'Блок кода'],
] as const
type Action = typeof options[number][0]
type Menu = { from: number; to: number; query: string; top: number; left: number; slash: boolean }
type Dialog = { kind: 'video' | 'math' | 'link'; value: string; from: number; to: number; mathPos?: number; inline?: boolean }

export function lectureExtensions(onMathClick?: (node: { attrs: Record<string, unknown> }, pos: number, inline: boolean) => void) {
  return [
    StarterKit.configure({ document: false, heading: { levels: [2, 3] }, link: { openOnClick: false, protocols: ['https', 'http', 'mailto'] } }), LectureRoot,
    TextAlign.configure({ types: ['heading', 'paragraph'] }), TableKit.configure({ table: { resizable: false } }), TableCellBackground,
    TextStyle, Color, Highlight.configure({ multicolor: true }),
    Callout, LectureImage, LectureVideo,
    Mathematics.configure({ katexOptions: { throwOnError: false, trust: false, strict: 'ignore' },
      blockOptions: { onClick: (node, pos) => onMathClick?.(node, pos, false) },
      inlineOptions: { onClick: (node, pos) => onMathClick?.(node, pos, true) } }),
  ]
}

export function LectureDocumentEditor({ blocks, disabled, onChange, onUpload, onError, toolbarTarget, lessonId }: {
  blocks: Block[]; disabled: boolean; onChange: (blocks: Block[]) => void; onUpload: (delta: number) => void; onError: (message: string) => void; toolbarTarget?: HTMLElement | null
  lessonId?: string
}) {
  const { t } = useI18n()
  const [menu, setMenu] = useState<Menu | null>(null)
  const [menuIndex, setMenuIndex] = useState(0)
  const menuRef = useRef(menu); menuRef.current = menu
  const indexRef = useRef(menuIndex); indexRef.current = menuIndex
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [reorder, setReorder] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hoverPos = useRef(-1)
  const [initial] = useState(() => blocksToDocument(blocks))
  const extensions = useMemo(() => lectureExtensions((node, pos, inline) => {
    setDialogError(''); setDialog({ kind: 'math', value: String(node.attrs.latex ?? ''), from: pos, to: pos, mathPos: pos, inline })
  }), [])
  const runRef = useRef<(action: Action) => void>(() => {})
  const uploadRef = useRef<(file: File, editor: Editor, replacePos?: number) => void>(() => {})
  const refreshSlash = (instance: Editor) => {
    const { $from, empty } = instance.state.selection
    const match = empty && $from.parent.isTextblock ? /(?:^|\s)\/([^\s/]*)$/u.exec($from.parent.textContent.slice(0, $from.parentOffset)) : null
    if (!match) { setMenu(current => current?.slash ? null : current); return }
    const query = match[1] ?? ''
    const caret = instance.view.coordsAtPos(instance.state.selection.from)
    setMenu({ from: instance.state.selection.from - query.length - 1, to: instance.state.selection.from, query, top: caret.bottom + 6, left: Math.max(8, Math.min(caret.left, window.innerWidth - 264)), slash: true })
    setMenuIndex(0)
  }
  const editor = useEditor({
    extensions,
    content: initial, editable: !disabled,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': t('Текст лекции'), 'aria-multiline': 'true', 'data-placeholder': t('Начните писать текст лекции…') },
      handleKeyDown: (_, event) => {
        const current = menuRef.current
        if (!current) return false
        const visible = options.filter(([, label]) => t(label).toLowerCase().includes(current.query.toLowerCase()))
        if (event.key === 'Escape') { setMenu(null); return true }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          setMenuIndex(index => visible.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length : 0); return true
        }
        if (event.key === 'Enter' && visible.length) { runRef.current(visible[indexRef.current % visible.length]![0]); return true }
        return false
      },
      handlePaste: (_, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault(); files.forEach(file => uploadRef.current(file, editor!)); return true
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'))
        if (moved || !files.length) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        if (pos !== undefined) editor?.commands.setTextSelection(pos)
        files.forEach(file => uploadRef.current(file, editor!)); return true
      },
    },
    onUpdate: ({ editor: instance }) => { onChange(documentToBlocks(instance.getJSON())); refreshSlash(instance) },
    onSelectionUpdate: ({ editor: instance }) => refreshSlash(instance),
  })
  useEffect(() => { editor?.setEditable(!disabled && !importOpen, false) }, [editor, disabled, importOpen])
  useEffect(() => {
    if (!editor) return
    editor.storage.lectureImage.replace = (pos, file) => uploadRef.current(file, editor, pos)
    return () => { editor.storage.lectureImage.replace = undefined }
  }, [editor])
  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest('.lecture-insert-menu,.lecture-insert-trigger')) setMenu(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [Boolean(menu)])
  useEffect(() => {
    if (!dialog) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDialog(null) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [dialog])

  const state = useEditorState({ editor, selector: ({ editor: instance }) => {
    const headings: { pos: number; title: string; level: number }[] = []
    instance?.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') headings.push({ pos, title: node.textContent, level: node.attrs.level }) })
    const doc = instance?.state.doc
    const text = doc?.textBetween(0, doc.content.size, ' ').trim() ?? ''
    return { headings, words: text ? text.split(/\s+/u).length : 0, table: instance?.isActive('table'), callout: instance?.isActive('callout') }
  } })

  uploadRef.current = async (file, instance, replacePos) => {
    if (!instance.isEditable) return
    const uploadId = crypto.randomUUID()
    const selection = instance.state.selection
    const insertAt = selection.$from.depth ? selection.$from.after(1) : selection.from
    const node = { type: 'lectureImage', attrs: { uploadId } }
    const storage = instance.storage.lectureImage
    onUpload(1)
    if (replacePos !== undefined) {
      const current = instance.state.doc.nodeAt(replacePos)
      if (!current || current.type.name !== 'lectureImage') { onUpload(-1); return }
      instance.view.dispatch(instance.state.tr.setNodeMarkup(replacePos, undefined, { ...current.attrs, uploadId }))
    } else instance.chain().focus().insertContentAt(Math.min(insertAt, instance.state.doc.content.size), node).run()
    try {
      const prepared = await prepareImageForUpload(file)
      const form = new FormData(); form.append('file', prepared)
      const media = await api<{ id: number; url: string }>('media/', 'POST', form)
      if (instance.isDestroyed) return
      storage.uploads.set(uploadId, { media: media.id, src: media.url })
      instance.view.dispatch(instance.state.tr)
    } catch (error) {
      if (!instance.isDestroyed) { storage.uploads.set(uploadId, null); instance.view.dispatch(instance.state.tr) }
      onError(error instanceof Error ? error.message : t('Не удалось загрузить изображение'))
    } finally { onUpload(-1) }
  }
  if (!editor) return null

  const openMenu = (button: HTMLElement, after?: number) => {
    const rect = button.getBoundingClientRect()
    const selection = editor.state.selection
    setMenu({ from: after ?? selection.from, to: after ?? selection.to, query: '', top: rect.bottom + 8, left: Math.max(8, Math.min(rect.left, window.innerWidth - 264)), slash: false }); setMenuIndex(0)
  }
  const openDialog = (kind: Dialog['kind'], from = editor.state.selection.from, to = editor.state.selection.to) => {
    setDialogError(''); setDialog({ kind, value: kind === 'link' ? String(editor.getAttributes('link').href ?? '') : '', from, to })
  }
  const run = (action: Action) => {
    const current = menuRef.current
    if (current) {
      if (!current.slash && editor.state.doc.resolve(current.from).depth === 0) {
        editor.chain().focus().insertContentAt(current.from, { type: 'paragraph' }).setTextSelection(current.from + 1).run()
      } else editor.chain().focus().setTextSelection({ from: current.from, to: current.to }).run()
      if (current.slash) editor.commands.deleteSelection()
    }
    setMenu(null)
    if (action === 'image') { fileRef.current?.click(); return }
    if (action === 'video' || action === 'math') { openDialog(action); return }
    if (action === 'paragraph') editor.chain().focus().setParagraph().run()
    if (action === 'heading') editor.chain().focus().setHeading({ level: 2 }).run()
    if (action === 'bullet') editor.chain().focus().toggleBulletList().run()
    if (action === 'ordered') editor.chain().focus().toggleOrderedList().run()
    if (action === 'quote') editor.chain().focus().toggleBlockquote().run()
    if (action === 'code') editor.chain().focus().toggleCodeBlock().run()
    if (action === 'rule') editor.chain().focus().setHorizontalRule().run()
    if (action === 'table') editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    if (['important', 'note', 'tip'].includes(action)) editor.chain().focus().insertContent({ type: 'callout', attrs: { tone: action }, content: [{ type: 'paragraph', content: [{ type: 'text', text: t(action === 'important' ? 'Важно' : action === 'tip' ? 'Совет' : 'Примечание') }] }] }).run()
  }
  runRef.current = run

  const blockAction = (action: 'delete' | 'duplicate' | 'up' | 'down') => {
    const pos = hoverPos.current
    const node = pos >= 0 ? editor.state.doc.nodeAt(pos) : null
    if (!node || !editor.isEditable) return
    const end = pos + node.nodeSize
    if (action === 'delete') editor.chain().focus().deleteRange({ from: pos, to: end }).run()
    if (action === 'duplicate') editor.chain().focus().insertContentAt(end, node.toJSON()).run()
    if (action === 'up' || action === 'down') {
      const sibling = action === 'up' ? editor.state.doc.resolve(pos).nodeBefore : editor.state.doc.resolve(end).nodeAfter
      if (!sibling) return
      const target = action === 'up' ? pos - sibling.nodeSize : pos + sibling.nodeSize
      const tr = editor.state.tr.delete(pos, end).insert(target, node)
      editor.view.dispatch(tr.scrollIntoView())
      hoverPos.current = target
    }
  }
  const submitDialog = () => {
    if (!dialog || disabled) return
    const value = dialog.value.trim()
    if (dialog.kind === 'video') {
      if (!videoSource(value)) { setDialogError(t('Укажите HTTPS-ссылку на YouTube, RuTube или MP4')); return }
      editor.chain().focus().insertContentAt({ from: dialog.from, to: dialog.to }, { type: 'lectureVideo', attrs: { src: value } }).run()
    } else if (dialog.kind === 'math') {
      if (!value) { setDialogError(t('Введите формулу')); return }
      if (dialog.mathPos !== undefined) {
        const chain = editor.chain().focus()
        if (dialog.inline) chain.updateInlineMath({ pos: dialog.mathPos, latex: value }).run()
        else chain.updateBlockMath({ pos: dialog.mathPos, latex: value }).run()
      } else editor.chain().focus().setTextSelection({ from: dialog.from, to: dialog.to }).insertBlockMath({ latex: value }).run()
    } else {
      if (value && !/^(https?:\/\/|mailto:)/i.test(value)) { setDialogError(t('Укажите ссылку https:// или mailto:')); return }
      const chain = editor.chain().focus().setTextSelection({ from: dialog.from, to: dialog.to }).extendMarkRange('link')
      if (value) chain.setLink({ href: value }).run(); else chain.unsetLink().run()
    }
    setDialog(null)
  }
  const visible = menu ? options.filter(([, label]) => t(label).toLowerCase().includes(menu.query.toLowerCase())) : []
  const ribbon = <LectureRibbon editor={editor} disabled={disabled} outlineOpen={outlineOpen} reorder={reorder} onOutline={() => setOutlineOpen(value => !value)} onReorder={() => setReorder(value => !value)} onInsert={run} onLink={() => openDialog('link')} onImport={lessonId ? () => setImportOpen(true) : undefined}/>

  return <div className={`lecture-composer${disabled ? ' is-disabled' : ''}`}>
    {importOpen && lessonId && <LectureImportDialog lessonId={lessonId} onClose={() => setImportOpen(false)} onApply={(imported, mode) => {
      if (disabled) throw new Error(t('Дождитесь сохранения лекции.'))
      const incoming = blocksToDocument(imported).content ?? []
      const combined = { type: 'doc', content: mode === 'append' ? [...(editor.getJSON().content ?? []), ...incoming] : incoming }
      const converted = documentToBlocks(combined)
      if (converted.length > 100 || converted.some(block => block.content.length > 50000)) throw new Error(t('Содержимое слишком большое. Импортируйте документ частями.'))
      const end = editor.state.doc.content.size
      editor.chain().command(({ tr }) => { closeHistory(tr); return true }).insertContentAt(mode === 'replace' ? { from: 0, to: end } : end, incoming).run()
      setImportOpen(false)
    }}/>}
    {toolbarTarget ? createPortal(ribbon, toolbarTarget) : ribbon}
    {outlineOpen && <nav className="lecture-outline" aria-label={t('Оглавление лекции')}><strong>{t('Оглавление')}</strong>{state?.headings.length ? state.headings.map(heading => <button type="button" key={heading.pos} className={heading.level === 3 ? 'outline-nested' : ''} onClick={() => { editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run(); (editor.view.nodeDOM(heading.pos) as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }) }}>{heading.title || t('Без названия')}</button>) : <p>{t('Добавьте заголовки, чтобы видеть структуру лекции.')}</p>}</nav>}
    {reorder && !disabled && <DragHandle editor={editor} onNodeChange={({ pos }) => { hoverPos.current = pos }}><div className="lecture-block-handle">
      <button type="button" className="lecture-insert-trigger" aria-label={t('Добавить после блока')} onMouseDown={event => event.preventDefault()} onClick={event => { const node = editor.state.doc.nodeAt(hoverPos.current); if (node) openMenu(event.currentTarget, hoverPos.current + node.nodeSize) }}><Plus size={16}/></button>
      <button type="button" className="lecture-grip" aria-label={t('Перетащить блок')} title={t('Перетащить блок')} onClick={() => { if (hoverPos.current >= 0) editor.chain().focus().setNodeSelection(hoverPos.current).run() }}><GripVertical size={18}/></button>
      <div className="lecture-block-actions">
        <button type="button" aria-label={t('Выше')} title={t('Выше')} onClick={() => blockAction('up')}><ArrowUp size={15}/></button>
        <button type="button" aria-label={t('Ниже')} title={t('Ниже')} onClick={() => blockAction('down')}><ArrowDown size={15}/></button>
        <button type="button" aria-label={t('Дублировать')} title={t('Дублировать')} onClick={() => blockAction('duplicate')}><Copy size={15}/></button>
        <button type="button" aria-label={t('Удалить блок')} title={t('Удалить блок')} onClick={() => blockAction('delete')}><Trash2 size={15}/></button>
      </div>
    </div></DragHandle>}
    {state?.table && !disabled && <div className="lecture-table-tools" role="toolbar" aria-label={t('Таблица')}>
      <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>{t('+ Строка')}</button>
      <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>{t('+ Столбец')}</button>
      <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>{t('Удалить строку')}</button>
      <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>{t('Удалить столбец')}</button>
      <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>{t('Удалить таблицу')}</button>
    </div>}
    {state?.callout && !disabled && <div className="lecture-table-tools"><select aria-label={t('Тип врезки')} value={editor.getAttributes('callout').tone} onChange={event => editor.chain().focus().updateAttributes('callout', { tone: event.target.value }).run()}><option value="important">{t('Важно')}</option><option value="note">{t('Примечание')}</option><option value="tip">{t('Совет')}</option></select><button type="button" onClick={() => editor.chain().focus().lift('callout').run()}>{t('Убрать врезку')}</button></div>}
    <EditorContent editor={editor} className="lecture-document-content"/>
    <div className="lecture-word-count">{t('Слов')}: {state?.words ?? 0}</div>
    {menu && !disabled && <div className="lecture-insert-menu" role="menu" aria-label={t('Добавить содержимое')} style={{ top: Math.min(menu.top, Math.max(8, window.innerHeight - 355)), left: menu.left }}>
      <input autoFocus={!menu.slash} aria-label={t('Поиск типа содержимого')} placeholder={t('Найти…')} value={menu.query} onChange={event => { setMenu({ ...menu, query: event.target.value }); setMenuIndex(0) }} onKeyDown={event => {
        if (event.key === 'Escape') { setMenu(null); editor.commands.focus() }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setMenuIndex(index => visible.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length : 0) }
        if (event.key === 'Enter' && visible.length) { event.preventDefault(); run(visible[menuIndex % visible.length]![0]) }
      }}/>
      <div>{visible.map(([action, label], index) => <button type="button" role="menuitem" key={action} className={index === menuIndex ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => run(action)}>{t(label)}</button>)}{!visible.length && <p>{t('Ничего не найдено')}</p>}</div>
    </div>}
    <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) uploadRef.current(file, editor); event.currentTarget.value = '' }}/>
    {dialog && <div className="lecture-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setDialog(null) }}><form className="lecture-dialog" role="dialog" aria-modal="true" aria-label={t(dialog.kind === 'video' ? 'Видео' : dialog.kind === 'math' ? 'Формула LaTeX' : 'Ссылка')} onSubmit={event => { event.preventDefault(); submitDialog() }} onKeyDown={event => { if (event.key === 'Tab') { const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,textarea')); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } } }}>
      <div><h2>{t(dialog.kind === 'video' ? 'Видео' : dialog.kind === 'math' ? 'Формула LaTeX' : 'Ссылка')}</h2><button type="button" aria-label={t('Закрыть')} onClick={() => setDialog(null)}><X size={18}/></button></div>
      <label>{t(dialog.kind === 'math' ? 'LaTeX' : 'Адрес ссылки')}<input autoFocus value={dialog.value} onChange={event => { setDialog({ ...dialog, value: event.target.value }); setDialogError('') }} placeholder={dialog.kind === 'math' ? 'E = mc^2' : 'https://'}/></label>
      {dialog.kind === 'video' && <p>{t('YouTube, RuTube или прямая ссылка на MP4')}</p>}
      {dialogError && <p role="alert">{dialogError}</p>}
      <footer><button type="button" onClick={() => setDialog(null)}>{t('Отмена')}</button><button type="submit" disabled={disabled}>{t('Применить')}</button></footer>
    </form></div>}
  </div>
}
