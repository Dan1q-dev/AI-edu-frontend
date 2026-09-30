import type { Course, Lesson, Module } from '../api'

export type EntityKind = 'courses' | 'modules' | 'lessons'
export type Entity = Course | Module | Lesson
export type EntitySelection = { kind: EntityKind; item: Entity }

export const entityKey = (kind: EntityKind, item: Entity) => kind === 'courses' ? (item as Course).slug : item.short_id
export const entityPath = (kind: EntityKind, item: Entity) => {
  if (kind === 'courses') return `/admin/curriculum/courses/${(item as Course).slug}`
  if (kind === 'modules') return `/admin/curriculum/modules/${item.short_id}`
  return `/admin/curriculum/lessons/${item.short_id}/edit`
}
export const sortByPosition = <T extends { position: number; id: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position || a.id - b.id)
