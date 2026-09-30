import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Code, Code2, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react'

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] }
const safeHref = (value: string) => /^(https?:|mailto:)/i.test(value) ? value : undefined

function parseInline(source: string): Node[] {
  const nodes: Node[] = []
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push({ type: 'text', text: source.slice(cursor, index) })
    const marks: Node['marks'] = []
    let text = ''
    if (match[1]) { text = match[1]; marks.push({ type: 'link', attrs: { href: match[2] } }) }
    else if (match[3] || match[4]) { text = match[3] || match[4] || ''; marks.push({ type: 'bold' }) }
    else if (match[5] || match[6]) { text = match[5] || match[6] || ''; marks.push({ type: 'italic' }) }
    else { text = match[7] || ''; marks.push({ type: 'code' }) }
    nodes.push({ type: 'text', text, marks }); cursor = index + match[0].length
  }
  if (cursor < source.length) nodes.push({ type: 'text', text: source.slice(cursor) })
  return nodes
}

export function legacyTextToDocument(value: string): Node {
  const lines = value.replace(/\r/g, '').split('\n')
  const content: Node[] = []
  let paragraph: string[] = []
  const flush = () => { if (paragraph.length) { content.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) }); paragraph = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!line.trim()) { flush(); continue }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) { flush(); content.push({ type: 'heading', attrs: { level: Math.min(3, heading[1]!.length) }, content: parseInline(heading[2]!) }); continue }
    if (/^```/.test(line)) {
      flush(); const code: string[] = []; i++
      while (i < lines.length && !/^```/.test(lines[i] ?? '')) code.push(lines[i++] ?? '')
      content.push({ type: 'codeBlock', content: [{ type: 'text', text: code.join('\n') }] }); continue
    }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { flush(); content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: parseInline(quote[1]!) }] }); continue }
    const list = /^\s*([-*+] |\d+\. )(.*)$/.exec(line)
    if (list) {
      flush(); const ordered = /^\d/.test(list[1]!)
      const type = ordered ? 'orderedList' : 'bulletList'
      const last = content[content.length - 1]
      if (last?.type !== type) content.push({ type, content: [] })
      content[content.length - 1]!.content!.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(list[2]!) }] })
      continue
    }
    paragraph.push(line.trim())
  }
  flush()
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function parseLessonContent(value: string): Node {
  try {
    const parsed = JSON.parse(value) as Node
    if (parsed?.type === 'doc' && Array.isArray(parsed.content)) return parsed
  } catch { /* Existing lessons store Markdown text. */ }
  return legacyTextToDocument(value)
}

export function RichLessonContent({ value }: { value: string }) {
  let document: Node | null = null
  try { const parsed = JSON.parse(value) as Node; if (parsed?.type === 'doc' && Array.isArray(parsed.content)) document = parsed } catch { /* legacy Markdown */ }
  if (!document) return null
  const render = (node: Node, key: string): ReactNode => {
    const children = node.content?.map((child, index) => render(child, `${key}-${index}`))
    if (node.type === 'text') {
      let element: React.ReactNode = node.text
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') element = <strong key={key}>{element}</strong>
        else if (mark.type === 'italic') element = <em key={key}>{element}</em>
        else if (mark.type === 'code') element = <code key={key}>{element}</code>
        else if (mark.type === 'link') { const href = safeHref(String(mark.attrs?.href ?? '')); element = href ? <a key={key} href={href} rel="noreferrer">{element}</a> : <>{element}</> }
      }
      return element
    }
    switch (node.type) {
      case 'doc': return <>{children}</>
      case 'paragraph': return <p key={key}>{children}</p>
      case 'heading': return Number(node.attrs?.level) === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>
      case 'bulletList': return <ul key={key}>{children}</ul>
      case 'orderedList': return <ol key={key}>{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key}>{children}</blockquote>
      case 'codeBlock': return <pre key={key}><code>{children}</code></pre>
      case 'hardBreak': return <br key={key}/>
      default: return <>{children}</>
    }
  }
  return <>{render(document, 'root')}</>
}

type SlashAction = 'text' | 'heading' | 'bullet' | 'numbered' | 'quote' | 'code' | 'image'
const slashOptions: { id: SlashAction; label: string }[] = [
  { id: 'text', label: 'Text' }, { id: 'heading', label: 'Heading' },
  { id: 'bullet', label: 'Bulleted List' }, { id: 'numbered', label: 'Numbered List' },
  { id: 'quote', label: 'Quote' }, { id: 'code', label: 'Code Block' },
  { id: 'image', label: 'Image' },
]

export function SlashCommandMenu({ query, activeIndex, position, onSelect }: { query: string; activeIndex: number; position: { top: number; left: number }; onSelect: (action: SlashAction) => void }) {
  const options = slashOptions.filter(option => option.label.toLowerCase().includes(query.toLowerCase()))
  if (!options.length) return null
  return <div className="slash-command-menu" role="menu" aria-label="Вставить в документ" style={position}>{options.map((option, index) => <button key={option.id} className={index === activeIndex ? 'active' : ''} type="button" role="menuitem" onMouseDown={event => event.preventDefault()} onClick={() => onSelect(option.id)}>{option.label}</button>)}</div>
}

export function LessonTextEditor({ value, onChange, disabled = false, formatRequest, onInsertImage, onDropImage }: { value: string; onChange: (value: string) => void; disabled?: boolean; formatRequest?: string; onInsertImage?: () => void; onDropImage?: (file: File) => void }) {
  const [slashQuery, setSlashQuery] = useState<string | null>(null)
  const [activeSlashIndex, setActiveSlashIndex] = useState(0)
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })
  const surfaceRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Link.configure({ openOnClick: false, protocols: ['mailto'] })],
    content: parseLessonContent(value), editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      onChange(JSON.stringify(instance.getJSON()))
      const { $from } = instance.state.selection
      const before = $from.parent.textContent.slice(0, $from.parentOffset)
      setSlashQuery(/\/([a-z]*)$/i.exec(before)?.[1] ?? null)
      setActiveSlashIndex(0)
      const surface = surfaceRef.current?.getBoundingClientRect()
      if (surface) {
        const caret = instance.view.coordsAtPos(instance.state.selection.from)
        setSlashPosition({ top: caret.bottom - surface.top + 5, left: Math.max(0, Math.min(caret.left - surface.left, surface.width - 220)) })
      }
    },
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  useEffect(() => {
    if (!editor) return
    const incoming = parseLessonContent(value)
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(incoming)) editor.commands.setContent(incoming, { emitUpdate: false })
  }, [editor, value])
  useEffect(() => {
    if (!editor || !formatRequest) return
    const type = formatRequest.split(':')[1]
    if (type === 'paragraph') editor.chain().focus().setParagraph().run()
    if (type === 'heading') editor.chain().focus().setHeading({ level: 2 }).run()
    if (type === 'bulletList') editor.chain().focus().toggleBulletList().run()
    if (type === 'orderedList') editor.chain().focus().toggleOrderedList().run()
    if (type === 'blockquote') editor.chain().focus().toggleBlockquote().run()
    if (type === 'codeBlock') editor.chain().focus().toggleCodeBlock().run()
  }, [editor, formatRequest])
  if (!editor) return null
  const action = (label: string, icon: ReactNode, active: boolean, run: () => void) => <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} className={active ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={run}>{icon}</button>
  const setLink = () => { const current = editor.getAttributes('link').href as string | undefined; const href = window.prompt('Адрес ссылки', current || 'https://'); if (href === null) return; if (!href.trim()) editor.chain().focus().unsetLink().run(); else if (safeHref(href)) editor.chain().focus().extendMarkRange('link').setLink({ href }).run() }
  const runSlash = (action: SlashAction) => {
    if (slashQuery === null) return
    const end = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: end - slashQuery.length - 1, to: end }).run()
    setSlashQuery(null)
    if (action === 'text') editor.chain().focus().setParagraph().run()
    if (action === 'heading') editor.chain().focus().toggleHeading({ level: 2 }).run()
    if (action === 'bullet') editor.chain().focus().toggleBulletList().run()
    if (action === 'numbered') editor.chain().focus().toggleOrderedList().run()
    if (action === 'quote') editor.chain().focus().toggleBlockquote().run()
    if (action === 'code') editor.chain().focus().toggleCodeBlock().run()
    if (action === 'image') {
      if (onDropImage) imageInputRef.current?.click()
      else onInsertImage?.()
    }
  }
  const visibleSlashOptions = slashQuery === null ? [] : slashOptions.filter(option => option.label.toLowerCase().includes(slashQuery.toLowerCase()))
  return <div className="lesson-rich-editor">
    <div className="rich-toolbar" role="toolbar" aria-label="Форматирование текста">
      {action('Жирный', <Bold size={16}/>, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {action('Курсив', <Italic size={16}/>, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {action('Заголовок 2', <Heading2 size={16}/>, editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {action('Заголовок 3', <Heading3 size={16}/>, editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      {action('Маркированный список', <List size={16}/>, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {action('Нумерованный список', <ListOrdered size={16}/>, editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      {action('Цитата', <Quote size={16}/>, editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
      {action('Встроенный код', <Code size={16}/>, editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
      {action('Блок кода', <Code2 size={16}/>, editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run())}
      {action('Ссылка', <Link2 size={16}/>, editor.isActive('link'), setLink)}
      <span className="rich-toolbar-spacer"/>
      {action('Отменить', <Undo2 size={16}/>, false, () => editor.chain().focus().undo().run())}
      {action('Повторить', <Redo2 size={16}/>, false, () => editor.chain().focus().redo().run())}
    </div>
    <div ref={surfaceRef} className="rich-editor-surface" onKeyDown={event => { if (slashQuery === null || !visibleSlashOptions.length) return; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActiveSlashIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + visibleSlashOptions.length) % visibleSlashOptions.length) } else if (event.key === 'Enter') { event.preventDefault(); runSlash(visibleSlashOptions[activeSlashIndex % visibleSlashOptions.length]!.id) } else if (event.key === 'Escape') { event.preventDefault(); setSlashQuery(null) } }} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDrop={event => { const file = Array.from(event.dataTransfer.files).find(candidate => candidate.type.startsWith('image/')); if (file && onDropImage) { event.preventDefault(); onDropImage(file) } }}><EditorContent editor={editor} className="rich-editor-content"/>{slashQuery !== null && <SlashCommandMenu query={slashQuery} activeIndex={activeSlashIndex} position={slashPosition} onSelect={runSlash}/>}<input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) onDropImage?.(file); event.currentTarget.value = '' }}/></div>
  </div>
}
