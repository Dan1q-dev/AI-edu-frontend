import type { PracticePlugin } from './types'
import { LectureWorkshop } from '../workspace/LectureWorkshop'

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
