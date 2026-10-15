import { Download, FileText, Paperclip, Trash2 } from 'lucide-react'
import type { LessonAttachment } from '../api'
import { useI18n } from '../i18n'
import './lesson-attachments.css'

export function fileSize(bytes: number, english = false) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} ${english ? 'MB' : 'МБ'}` : `${Math.max(1, Math.round(bytes / 1024))} ${english ? 'KB' : 'КБ'}`
}

export function LessonAttachments({ attachments, onRemove }: { attachments: LessonAttachment[]; onRemove?: (media: number) => void }) {
  const { t, locale } = useI18n()
  if (!attachments.length) return null
  return <section className="lesson-attachments" aria-label={t('Дополнительные материалы')}>
    <div className="lesson-attachments-heading"><Paperclip size={18}/><h2>{t('Дополнительные материалы')}</h2><span>{attachments.length}</span></div>
    <div className="lesson-attachment-list">{attachments.map(file => <div className="lesson-attachment" key={file.media}>
      <span className="lesson-attachment-icon"><FileText size={19}/></span>
      <span className="lesson-attachment-details"><strong title={file.name}>{file.name}</strong><small>{fileSize(file.size, locale === 'en')}</small></span>
      {onRemove && <button type="button" className="lesson-attachment-remove" aria-label={`${t('Удалить файл')}: ${file.name}`} onClick={() => onRemove(file.media)}><Trash2 size={17}/></button>}
      <a href={file.url} className="lesson-attachment-download" aria-label={`${t('Скачать файл')}: ${file.name}`} download={file.name}><Download size={17}/><span>{t('Скачать')}</span></a>
    </div>)}</div>
  </section>
}
