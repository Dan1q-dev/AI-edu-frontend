import { useEffect, useRef, useState } from 'react'
import { Highlighter, Baseline } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { useI18n } from '../i18n'
import { safeTextColor } from './colors'

const colors = ['#111827', '#64748b', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777']
const highlights = ['#fef08a', '#fed7aa', '#fecaca', '#fbcfe8', '#ddd6fe', '#bfdbfe', '#a5f3fc', '#bbf7d0', '#e2e8f0', '#ffffff']

export function LectureColorPicker({ editor, disabled, highlight, value }: { editor: Editor; disabled: boolean; highlight?: boolean; value?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const label = t(highlight ? 'Цвет выделения' : 'Цвет текста')
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const apply = (color?: string, close = true) => {
    const chain = editor.chain()
    if (close) chain.focus()
    if (highlight) { if (color) chain.setHighlight({ color }).run(); else chain.unsetHighlight().run() }
    else { if (color) chain.setColor(color).run(); else chain.unsetColor().run() }
    if (close) setOpen(false)
  }
  return <div className="ribbon-dropdown" ref={ref}>
    <button ref={trigger} type="button" className="ribbon-icon ribbon-color-trigger" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => setOpen(!open)}>
      {highlight ? <Highlighter size={17}/> : <Baseline size={17}/>}<span style={{ backgroundColor: safeTextColor(value) ?? (highlight ? '#fef08a' : '#111827') }}/>
    </button>
    {open && <div className="ribbon-color-menu" role="dialog" aria-label={label}>
      <strong>{label}</strong>
      <div className="ribbon-color-swatches">{(highlight ? highlights : colors).map(color => <button key={color} type="button" aria-label={`${label}: ${color}`} title={color} aria-pressed={value?.toLowerCase() === color} style={{ backgroundColor: color }} onMouseDown={event => event.preventDefault()} onClick={() => apply(color)}/>)}</div>
      <label className="ribbon-custom-color">{t('Другой цвет')}<input type="color" aria-label={t(highlight ? 'Другой цвет выделения' : 'Другой цвет текста')} defaultValue={value?.startsWith('#') ? value : '#2563eb'} onChange={event => apply(event.target.value, false)}/></label>
      <button type="button" className="ribbon-color-reset" onMouseDown={event => event.preventDefault()} onClick={() => apply()}>{t(highlight ? 'Убрать выделение' : 'Автоматический цвет')}</button>
    </div>}
  </div>
}
