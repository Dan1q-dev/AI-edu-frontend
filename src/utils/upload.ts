import { translateCurrentLocale } from '../i18n'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip'

export function validateUploadSize(file: Blob) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(translateCurrentLocale('Максимальный размер файла — 10 МБ.'))
}
