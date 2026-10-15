import { api, apiAll } from '../api'
import { isLecture, type Lecture, type LectureParameters, type OperationInput, type WorkspaceDocument, type WorkspaceMessage, type WorkspaceOperation } from './types'

function checkedDocument(document: WorkspaceDocument): WorkspaceDocument {
  if (document.document_type !== 'lecture' || document.schema_version !== 1 ||
      (!isLecture(document.content) && Object.keys(document.content).length !== 0)) throw new Error('Формат лекции не поддерживается')
  return document
}
export const workspaceApi = {
  create: (item: string, language: LectureParameters['language']) => api<WorkspaceDocument>(`items/${item}/practice/workspace/`, 'POST', { language }).then(checkedDocument),
  document: (id: number) => api<WorkspaceDocument>(`workspace/documents/${id}/`).then(checkedDocument),
  save: (id: number, data: { revision: number; parameters: LectureParameters; content?: Lecture }) =>
    api<WorkspaceDocument>(`workspace/documents/${id}/`, 'PATCH', data).then(checkedDocument),
  messages: (id: number) => apiAll<WorkspaceMessage>(`workspace/documents/${id}/messages/`),
  start: (id: number, data: OperationInput) => api<WorkspaceOperation>(`workspace/documents/${id}/operations/`, 'POST', data),
  operation: (id: number) => api<WorkspaceOperation>(`workspace/operations/${id}/`),
}

// Only identifiers are persisted. Ownership/access always comes from the server.
export function referenceKey(owner: number | undefined, submission: number | undefined) {
  return owner && submission ? `ai-edu-workspace:${owner}:${submission}` : null
}
export function readReference(key: string | null): { document?: number; operation?: number } {
  try {
    const value = JSON.parse(key ? localStorage.getItem(key) || '{}' : '{}')
    return { document: Number.isSafeInteger(value.document) && value.document > 0 ? value.document : undefined,
      operation: Number.isSafeInteger(value.operation) && value.operation > 0 ? value.operation : undefined }
  } catch { return {} }
}
export function writeReference(key: string | null, document: number, operation?: number) {
  try { if (key) localStorage.setItem(key, JSON.stringify({ document, operation })) } catch { /* Storage is optional; server remains the source of truth. */ }
}
