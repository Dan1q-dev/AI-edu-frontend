import type { JSONContent } from '@tiptap/react'

export const sectionIds = ['goal', 'learning_outcomes', 'outline', 'introduction', 'main_material', 'examples', 'key_concepts', 'conclusions', 'control_questions', 'self_study'] as const
export type SectionId = typeof sectionIds[number]
export type LectureParameters = {
  discipline: string; topic: string; course: string; audience: string; duration_minutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'; learning_outcomes: string[]; language: 'ru' | 'kk' | 'en'
}
export type Lecture = { title: string; sections: { id: SectionId; title: string; content: JSONContent }[] }
export type WorkspaceDocument = {
  id: number; submission: number; document_type: string; schema_version: number
  parameters: LectureParameters; content: Lecture | Record<string, never>; revision: number; created_at: string; updated_at: string
}
export type WorkspaceMessage = { id: number; operation: number; role: 'user' | 'assistant'; text: string; content?: Lecture | null; created_at: string }
export type OperationInput = { request_id: string; revision: number; kind: 'generate' | 'improve_prompt'; prompt: string }
export type WorkspaceOperation = {
  id: number; document: number; request_id: string; kind: OperationInput['kind']; status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  base_revision: number; result: { content?: Lecture; revision?: number; improved_prompt?: string }; error_code: string
  model: string; duration_ms: number | null; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null
  cost: string | null; cost_currency: string; attempts: number; created_at: string; started_at: string | null; finished_at: string | null
}

export function isLecture(content: WorkspaceDocument['content']): content is Lecture {
  return typeof content.title === 'string' && Array.isArray(content.sections) && content.sections.length === 10 &&
    content.sections.every((section, index) => section.id === sectionIds[index] && typeof section.title === 'string' && section.content?.type === 'doc')
}
export function initialParameters(language: LectureParameters['language']): LectureParameters {
  return { discipline: '', topic: '', course: '', audience: '', duration_minutes: 45, difficulty: 'intermediate', learning_outcomes: [''], language }
}
export function normalizedParameters(value: LectureParameters): LectureParameters | null {
  const next = { ...value, discipline: value.discipline.trim(), topic: value.topic.trim(), course: value.course.trim(), audience: value.audience.trim(),
    learning_outcomes: value.learning_outcomes.map(row => row.trim()).filter(Boolean) }
  if (!next.discipline || next.discipline.length > 200 || !next.topic || next.topic.length > 300 || !next.course || next.course.length > 100 ||
    !next.audience || next.audience.length > 500 || !Number.isInteger(next.duration_minutes) || next.duration_minutes < 5 || next.duration_minutes > 480 ||
    next.learning_outcomes.length < 1 || next.learning_outcomes.length > 30 || next.learning_outcomes.some(row => row.length > 500)) return null
  return next
}
