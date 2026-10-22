import type { PracticePlugin } from './types'
import { LectureWorkshop } from '../workspace/LectureWorkshop'
import { GuidedAssignment } from './GuidedAssignment'
import { AssignmentConfigEditor } from './AssignmentConfigEditor'

const plugins = new Map<string, PracticePlugin>()
export function registerPractice(plugin: PracticePlugin) {
  const key = `${plugin.type}@${plugin.version}`
  if (plugins.has(key)) throw new Error(`Duplicate practice plugin: ${key}`)
  plugins.set(key, plugin)
}
export function getPracticePlugin(type: string, version: string) { return plugins.get(`${type}@${version}`) }

for (const type of ['lecture_workshop', 'checklist_practice']) {
  registerPractice({ type, version: '1.0.0', layout: 'workspace',
    initialConfig: () => ({}), ConfigEditor: () => null,
    StudentRuntime: LectureWorkshop, validateConfig: () => null,
  })
}

registerPractice({ type: 'guided_assignment', version: '1.0.0',
  initialConfig: () => ({ instructions: [JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })], criteria: [{ title: '', description: '', is_required: true }] }),
  ConfigEditor: AssignmentConfigEditor, StudentRuntime: GuidedAssignment,
  validateConfig: config => !Array.isArray(config.instructions) || !config.instructions.length || !Array.isArray(config.criteria) || !config.criteria.length
    || config.criteria.some(row => !row || typeof row.title !== 'string' || !row.title.trim()) ? 'Добавьте инструкцию и критерии задания' : null,
})
