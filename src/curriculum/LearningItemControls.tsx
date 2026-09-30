import { useEffect, useRef, useState } from 'react'
import { BookOpen, CheckCircle2, Code2, Plus } from 'lucide-react'
import type { LearningItem } from '../api'

export function LearningItemTypeIcon({ type }: { type: LearningItem['type'] }) {
  if (type === 'TEST') return <CheckCircle2 size={15} aria-hidden="true"/>
  if (type === 'PRACTICE') return <Code2 size={15} aria-hidden="true"/>
  return <BookOpen size={15} aria-hidden="true"/>
}

export const itemTypeLabel: Record<LearningItem['type'], string> = {
  LECTURE: 'Лекция', TEST: 'Тест', PRACTICE: 'Практика',
}

export function AddLearningItemMenu({ onSelect }: { onSelect: (type: LearningItem['type']) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className="add-learning-item" ref={ref}>
    <button className="curriculum-add-inline" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><Plus size={17}/> Добавить элемент</button>
    {open && <div className="add-learning-item-menu" role="menu">{(['LECTURE', 'TEST', 'PRACTICE'] as const).map(type => <button type="button" role="menuitem" key={type} onClick={() => { setOpen(false); onSelect(type) }}><LearningItemTypeIcon type={type}/>{type === 'PRACTICE' ? 'Практическая работа' : itemTypeLabel[type]}</button>)}</div>}
  </div>
}
