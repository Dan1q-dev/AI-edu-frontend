import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, GripVertical, ImagePlus, Italic, Link2, List, ListOrdered, Minus, MoreHorizontal, PanelLeft, Redo2, Sigma, StickyNote, Table2, Underline, Undo2, Video } from 'lucide-react'
import { useI18n } from '../i18n'

type InsertAction = 'image' | 'table' | 'video' | 'math' | 'rule' | 'important' | 'note' | 'tip'

export function LectureRibbon({ editor, disabled, outlineOpen, reorder, onOutline, onReorder, onInsert, onLink, onImport }: {
  editor: Editor; disabled: boolean; outlineOpen: boolean; reorder: boolean
  onOutline: () => void; onReorder: () => void; onInsert: (action: InsertAction) => void; onLink: () => void
  onImport?: () => void
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'home' | 'insert'>('home')
  const [menu, setMenu] = useState<'callout' | 'more' | null>(null)
  const ribbonRef = useRef<HTMLDivElement>(null)
  const state = useEditorState({ editor, selector: ({ editor: instance }) => ({
    undo: instance.can().undo(), redo: instance.can().redo(), bold: instance.isActive('bold'), italic: instance.isActive('italic'),
    underline: instance.isActive('underline'), bullet: instance.isActive('bulletList'), ordered: instance.isActive('orderedList'),
    alignment: instance.getAttributes('paragraph').textAlign ?? instance.getAttributes('heading').textAlign ?? 'left',
    style: instance.isActive('blockquote') ? 'quote' : instance.isActive('codeBlock') ? 'code' : instance.isActive('heading', { level: 2 }) ? 'h2' : instance.isActive('heading', { level: 3 }) ? 'h3' : 'paragraph',
  }) })
  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent) => { if (!ribbonRef.current?.contains(event.target as Node)) setMenu(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [menu])
  const button = (label: string, icon: ReactNode, action: () => void, active?: boolean, unavailable = false) => <button type="button" className="ribbon-icon" aria-label={t(label)} title={t(label)} aria-pressed={active} disabled={disabled || unavailable} onMouseDown={event => event.preventDefault()} onClick={action}>{icon}</button>
  const insert = (action: InsertAction) => { setMenu(null); onInsert(action) }

  return <div className="lecture-ribbon" ref={ribbonRef}>
    <div className="ribbon-topline">
      <div className="ribbon-tabs" role="tablist" aria-label={t('Инструменты лекции')} onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); const next = tab === 'home' ? 'insert' : 'home'; setTab(next)
          ribbonRef.current?.querySelector<HTMLButtonElement>(`#lecture-tab-${next}`)?.focus()
        }
      }}>
        <button type="button" role="tab" id="lecture-tab-home" aria-selected={tab === 'home'} aria-controls="lecture-ribbon-panel" tabIndex={tab === 'home' ? 0 : -1} onClick={() => { setTab('home'); setMenu(null) }}>{t('Главная')}</button>
        <button type="button" role="tab" id="lecture-tab-insert" aria-selected={tab === 'insert'} aria-controls="lecture-ribbon-panel" tabIndex={tab === 'insert' ? 0 : -1} onClick={() => { setTab('insert'); setMenu(null) }}>{t('Вставка')}</button>
      </div>
      <div className="ribbon-view-actions">
        {onImport && <button type="button" className="ribbon-outline-toggle" disabled={disabled} onClick={onImport}>{t('Импорт из файла')}</button>}
        <button type="button" className="ribbon-outline-toggle" aria-label={t('Оглавление')} aria-expanded={outlineOpen} onClick={onOutline}><PanelLeft size={16}/><span>{t('Оглавление')}</span></button>
        <div className="ribbon-dropdown">
          <button type="button" className="ribbon-icon" aria-label={t('Дополнительные инструменты')} title={t('Дополнительные инструменты')} aria-expanded={menu === 'more'} aria-haspopup="menu" onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={19}/></button>
          {menu === 'more' && <div role="menu" className="ribbon-menu ribbon-menu-right"><button type="button" role="menuitemcheckbox" aria-checked={reorder} onClick={() => { onReorder(); setMenu(null) }}><GripVertical size={16}/>{t('Упорядочить элементы')}</button></div>}
        </div>
      </div>
    </div>
    <div id="lecture-ribbon-panel" className="ribbon-panel" role="tabpanel" aria-labelledby={`lecture-tab-${tab}`}>
      {tab === 'home' ? <div className="ribbon-home" role="toolbar" aria-label={t('Форматирование текста')}>
        <div className="ribbon-group">{button('Отменить', <Undo2 size={17}/>, () => editor.chain().focus().undo().run(), undefined, !state.undo)}{button('Повторить', <Redo2 size={17}/>, () => editor.chain().focus().redo().run(), undefined, !state.redo)}</div>
        <div className="ribbon-group"><select aria-label={t('Стиль текста')} disabled={disabled} value={state.style} onChange={event => {
          const value = event.target.value, chain = editor.chain().focus()
          if (editor.isActive('blockquote')) chain.lift('blockquote')
          if (value === 'h2' || value === 'h3') chain.setHeading({ level: value === 'h2' ? 2 : 3 }).run()
          else if (value === 'quote') chain.setParagraph().wrapIn('blockquote').run()
          else if (value === 'code') chain.setCodeBlock().run()
          else chain.setParagraph().run()
        }}><option value="paragraph">{t('Обычный текст')}</option><option value="h2">{t('Заголовок раздела')}</option><option value="h3">{t('Подзаголовок')}</option><option value="quote">{t('Цитата')}</option><option value="code">{t('Блок кода')}</option></select></div>
        <div className="ribbon-group">{button('Жирный', <Bold size={17}/>, () => editor.chain().focus().toggleBold().run(), state.bold)}{button('Курсив', <Italic size={17}/>, () => editor.chain().focus().toggleItalic().run(), state.italic)}{button('Подчёркнутый', <Underline size={17}/>, () => editor.chain().focus().toggleUnderline().run(), state.underline)}{button('Ссылка', <Link2 size={17}/>, onLink)}</div>
        <div className="ribbon-group">{button('Маркированный список', <List size={18}/>, () => editor.chain().focus().toggleBulletList().run(), state.bullet)}{button('Нумерованный список', <ListOrdered size={18}/>, () => editor.chain().focus().toggleOrderedList().run(), state.ordered)}</div>
        <div className="ribbon-group">{button('Слева', <AlignLeft size={17}/>, () => editor.chain().focus().setTextAlign('left').run(), state.alignment === 'left')}{button('По центру', <AlignCenter size={17}/>, () => editor.chain().focus().setTextAlign('center').run(), state.alignment === 'center')}{button('Справа', <AlignRight size={17}/>, () => editor.chain().focus().setTextAlign('right').run(), state.alignment === 'right')}</div>
      </div> : <div className="ribbon-insert" role="toolbar" aria-label={t('Вставка содержимого')}>
        <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => insert('image')}><ImagePlus size={19}/><span>{t('Изображение')}</span></button>
        <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => insert('table')}><Table2 size={19}/><span>{t('Таблица')}</span></button>
        <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => insert('video')}><Video size={19}/><span>{t('Видео')}</span></button>
        <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onLink}><Link2 size={19}/><span>{t('Ссылка')}</span></button>
        <div className="ribbon-dropdown"><button type="button" disabled={disabled} aria-expanded={menu === 'callout'} aria-haspopup="menu" onMouseDown={event => event.preventDefault()} onClick={() => setMenu(menu === 'callout' ? null : 'callout')}><StickyNote size={19}/><span>{t('Врезка')}</span><ChevronDown size={12}/></button>
          {menu === 'callout' && <div className="ribbon-menu" role="menu">{(['important', 'note', 'tip'] as const).map(tone => <button key={tone} type="button" role="menuitem" onMouseDown={event => event.preventDefault()} onClick={() => insert(tone)}>{t(tone === 'important' ? 'Важно' : tone === 'tip' ? 'Совет' : 'Примечание')}</button>)}</div>}
        </div>
        <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => insert('math')}><Sigma size={19}/><span>{t('Формула LaTeX')}</span></button>
        <button type="button" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => insert('rule')}><Minus size={19}/><span>{t('Разделитель')}</span></button>
      </div>}
    </div>
    {reorder && <div className="ribbon-reorder-note"><GripVertical size={14}/>{t('Перетаскивайте элементы за ручку слева.')}<button type="button" onClick={onReorder}>{t('Готово')}</button></div>}
  </div>
}
