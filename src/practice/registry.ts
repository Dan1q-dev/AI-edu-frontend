import { ChecklistConfigEditor, ChecklistRuntime, validateChecklist } from './checklist'
import type { PracticePlugin } from './types'
import { LectureWorkshop } from '../workspace/LectureWorkshop'

const plugins = new Map<string, PracticePlugin>()
export function registerPractice(plugin: PracticePlugin) {
  const key = `${plugin.type}@${plugin.version}`
  if (plugins.has(key)) throw new Error(`Duplicate practice plugin: ${key}`)
  plugins.set(key, plugin)
}
export function getPracticePlugin(type: string, version: string) { return plugins.get(`${type}@${version}`) }

registerPractice({ type: 'checklist_practice', version: '1.0.0',
  initialConfig: () => ({ criteria: [{ title: '', description: '', is_required: true }] }),
  ConfigEditor: ChecklistConfigEditor, StudentRuntime: ChecklistRuntime, validateConfig: validateChecklist,
})

registerPractice({ type: 'lecture_workshop', version: '1.0.0', layout: 'workspace',
  initialConfig: () => ({ criteria: [{ title: '', description: '', is_required: true }] }),
  ConfigEditor: ChecklistConfigEditor, StudentRuntime: LectureWorkshop, validateConfig: validateChecklist,
})
