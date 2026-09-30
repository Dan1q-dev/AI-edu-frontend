import { Plus, Search } from 'lucide-react'
import type { Track } from '../api'
import { Select } from '../components/ui'
import { useI18n } from '../i18n'

export function TrackSelector({ tracks, value, hasUnassigned, onChange }: {
  tracks: Track[]; value: string; hasUnassigned: boolean; onChange: (value: string) => void
}) {
  const { t } = useI18n()
  return <label className="curriculum-track-selector"><span>{t('Траектория')}</span><Select aria-label={t('Траектория обучения')} value={value} onChange={event => onChange(event.target.value)}>{tracks.map(track => <option key={track.id} value={track.short_id}>{track.title}</option>)}{hasUnassigned && <option value="unassigned">{t('Без траектории')}</option>}</Select></label>
}

export function CurriculumHeader({ tracks, trackKey, hasUnassigned, search, onTrackChange, onSearchChange, onCreateCourse }: {
  tracks: Track[]; trackKey: string; hasUnassigned: boolean; search: string
  onTrackChange: (key: string) => void; onSearchChange: (value: string) => void; onCreateCourse: () => void
}) {
  const { t } = useI18n()
  return <header className="curriculum-explorer-header">
    <div className="curriculum-title-row"><div><span className="eyebrow">{t('УПРАВЛЕНИЕ ОБУЧЕНИЕМ')}</span><h1>{t('Учебная структура')}</h1><p>{t('Курсы, модули и элементы выбранной траектории')}</p></div><button className="curriculum-create-course" onClick={onCreateCourse} disabled={!tracks.find(track => track.short_id === trackKey)}><Plus size={17}/> {t('Создать курс')}</button></div>
    <div className="curriculum-controls"><TrackSelector tracks={tracks} value={trackKey} hasUnassigned={hasUnassigned} onChange={onTrackChange}/><label className="curriculum-search"><Search size={17}/><input aria-label={t('Поиск по учебной структуре')} value={search} onChange={event => onSearchChange(event.target.value)} placeholder={t('Найти курс, модуль или элемент')}/></label></div>
  </header>
}
