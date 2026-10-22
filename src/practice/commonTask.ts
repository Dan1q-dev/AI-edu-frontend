import type { Criterion, PracticeConfig } from './types'

export type TaskConfig = { instructions: string[]; criteria: Criterion[]; source_url?: string }
export const hasCommonTask = (type: string) => ['lecture_workshop', 'checklist_practice', 'guided_assignment'].includes(type)
export function defaultTaskConfig(): TaskConfig {
  return {
    instructions: [JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text',
      text: 'Выполните задание в выбранном инструменте. Проверьте результат по критериям самопроверки.' }] }] })],
    criteria: [
      { title: 'Результат соответствует теме и инструкции задания', description: '', is_required: true },
      { title: 'Содержание проверено, ошибки исправлены', description: '', is_required: true },
      { title: 'Материал структурирован и готов к использованию', description: '', is_required: true },
    ],
  }
}
export function normalizeTaskConfig(config: PracticeConfig): PracticeConfig & TaskConfig {
  return { ...defaultTaskConfig(), ...config } as PracticeConfig & TaskConfig
}
export function validateTaskConfig(config: PracticeConfig): string | null {
  return !Array.isArray(config.instructions) || !config.instructions.length || !Array.isArray(config.criteria) || !config.criteria.length
    || config.criteria.some(row => !row || typeof row.title !== 'string' || !row.title.trim())
    ? 'Добавьте инструкцию и критерии задания' : null
}
export const safeResultLink = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
