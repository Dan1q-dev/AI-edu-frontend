import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './select.css'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'> {
  compact?: boolean
  leadingIcon?: ReactNode
}

type Option = { value: string; label: string; disabled: boolean; group?: string }

function textContent(children: ReactNode): string {
  return Children.toArray(children).map(child => isValidElement<{ children?: ReactNode }>(child)
    ? textContent(child.props.children) : String(child)).join('')
}

function readOptions(children: ReactNode, group?: string, disabled = false): Option[] {
  const options: Option[] = []
  Children.forEach(children, child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean }>(child)) return
    const props = child.props
    if (child.type === 'option') {
      const label = props.label ?? textContent(props.children)
      options.push({ value: String(props.value ?? textContent(props.children)), label, disabled: disabled || !!props.disabled, group })
    } else {
      options.push(...readOptions(props.children, child.type === 'optgroup' ? props.label : group, disabled || !!props.disabled))
    }
  })
  return options
}

/** A single-choice listbox. The hidden native control preserves form values and change events. */
export function Select({ children, className = '', compact = false, leadingIcon, value, defaultValue, disabled,
  id, style, autoFocus, tabIndex, onChange, onInvalid, ...props }: SelectProps) {
  const generatedId = useId()
  const triggerId = id ?? `select-${generatedId}`
  const listId = `${triggerId}-options`
  const options = useMemo(() => readOptions(children), [children])
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? options.find(option => !option.disabled)?.value ?? ''))
  const currentValue = String(value ?? internalValue)
  const selectedIndex = options.findIndex(option => option.value === currentValue)
  const selected = options[selectedIndex] ?? options.find(option => !option.disabled)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [invalid, setInvalid] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const native = useRef<HTMLSelectElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const expanded = open && !disabled

  useLayoutEffect(() => {
    if (!expanded) return
    const update = () => {
      const rect = trigger.current!.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportWidth = viewport?.width ?? window.innerWidth
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
      if (rect.bottom < viewportTop || rect.top > viewportBottom) { setOpen(false); return }
      const below = viewportBottom - rect.bottom - 14
      const above = rect.top - viewportTop - 14
      const upwards = below < Math.min(menu.current?.scrollHeight ?? 288, 288) && above > below
      const width = Math.min(rect.width, viewportWidth - 16)
      setPosition({
        width, left: Math.max(viewportLeft + 8, Math.min(rect.left, viewportLeft + viewportWidth - width - 8)),
        top: upwards ? undefined : rect.bottom + 6,
        bottom: upwards ? window.innerHeight - rect.top + 6 : undefined,
        maxHeight: Math.max(0, Math.min(288, upwards ? above : below)),
      })
    }
    update()
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) update() }
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(trigger.current!)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', scroll, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    document.addEventListener('pointerdown', outside)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', scroll, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
      document.removeEventListener('pointerdown', outside)
    }
  }, [expanded, options])

  useEffect(() => {
    if (expanded) menu.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView?.({ block: 'nearest' })
  }, [expanded, active, listId])

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  useEffect(() => {
    const form = native.current?.form
    const reset = () => { setInternalValue(String(defaultValue ?? options.find(option => !option.disabled)?.value ?? '')); setInvalid(false); setOpen(false) }
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [defaultValue, options])

  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index !== -1)
  const show = (last = false) => {
    if (trigger.current?.matches(':disabled') || !enabled.length) return
    search.current = { text: '', time: 0 }
    setActive(selected && !selected.disabled ? options.indexOf(selected) : (last ? enabled.at(-1)! : enabled[0]))
    trigger.current?.focus({ preventScroll: true })
    setOpen(true)
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled || !native.current || trigger.current?.matches(':disabled')) return
    // Focus before dispatch: editor handlers may deliberately restore the text selection.
    trigger.current?.focus({ preventScroll: true })
    setOpen(false)
    native.current.value = option.value
    native.current.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'Enter' || event.key === ' ' && (!search.current.text || Date.now() - search.current.time > 700)) {
      event.preventDefault()
      if (expanded) choose(active)
      else show()
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!expanded) show(event.key === 'ArrowUp' || event.key === 'End')
      if (event.key === 'Home') setActive(enabled[0] ?? -1)
      else if (event.key === 'End') setActive(enabled.at(-1) ?? -1)
      else if (expanded) {
        const index = enabled.indexOf(active)
        setActive(enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length] ?? -1)
      }
      return
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    const now = Date.now()
    const query = (now - search.current.time > 700 ? '' : search.current.text) + event.key.toLocaleLowerCase()
    search.current = { text: query, time: now }
    const prefix = [...query].every(character => character === query[0]) ? query[0] : query
    const start = expanded ? active : selectedIndex
    const matches = (index: number) => !options[index].disabled && options[index].label.toLocaleLowerCase().startsWith(prefix)
    const ordered = options.map((_, offset) => (Math.max(start, -1) + 1 + offset) % options.length)
    const next = prefix.length > 1 && start >= 0 && matches(start) ? start : ordered.find(matches)
    if (next === undefined) return
    if (expanded) setActive(next)
    else choose(next)
  }

  return <span ref={root} className={`system-select${compact ? ' system-select--compact' : ''}`} style={style}>
    <button type="button" id={triggerId} ref={trigger} role="combobox" className={`input system-select-trigger ${className}`.trim()}
      disabled={disabled} autoFocus={autoFocus} tabIndex={tabIndex} aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']} aria-invalid={props['aria-invalid'] ?? (invalid || undefined)}
      aria-required={props.required || undefined} aria-haspopup="listbox" aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && active >= 0 && options[active] ? `${listId}-${active}` : undefined}
      title={props.title ?? selected?.label} onKeyDown={keyboard} onBlur={() => setOpen(false)}
      onClick={() => { if (expanded) setOpen(false); else show() }}>
      {leadingIcon && <span className="system-select-icon" aria-hidden="true">{leadingIcon}</span>}
      <span className="system-select-value">{selected?.label || '\u00a0'}</span>
      <ChevronDown size={16} className="system-select-chevron" aria-hidden="true"/>
    </button>
    <select {...props} ref={native} value={value} defaultValue={defaultValue} disabled={disabled} tabIndex={-1}
      hidden aria-hidden="true" aria-label={undefined} aria-labelledby={undefined} aria-describedby={undefined}
      onChange={event => { setInternalValue(event.currentTarget.value); setInvalid(false); onChange?.(event) }}
      onInvalid={event => { event.preventDefault(); setInvalid(true); trigger.current?.focus(); onInvalid?.(event) }}>
      {children}
    </select>
    {expanded && createPortal(<div ref={menu} id={listId} role="listbox" className="system-select-menu" style={position}
      aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby'] ?? (props['aria-label'] ? undefined : triggerId)}
      onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={`${index}-${option.value}`} role="presentation">
        {option.group && option.group !== options[index - 1]?.group && <div className="system-select-group">{option.group}</div>}
        <div id={`${listId}-${index}`} role="option" aria-selected={option.value === selected?.value} aria-disabled={option.disabled || undefined}
          className={`system-select-option${active === index ? ' is-active' : ''}`} title={option.label}
          onPointerMove={event => { if (event.pointerType !== 'touch' && !option.disabled) setActive(index) }} onClick={() => choose(index)}>
          <span>{option.label}</span>{option.value === selected?.value && <Check size={16} aria-hidden="true"/>}
        </div>
      </div>)}
    </div>, root.current?.closest('[role="dialog"], dialog') ?? document.body)}
  </span>
}
