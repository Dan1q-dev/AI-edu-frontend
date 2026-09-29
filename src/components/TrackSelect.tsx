import { BookOpen, FlaskConical, GraduationCap } from 'lucide-react'
import type { Track } from '../api'

export interface TrackSelectProps {
  tracks: Track[]
  selectedTrackId?: number | null
  onSelect: (trackId: number) => void
  isLoading?: boolean
  error?: string | null
  hasError?: boolean
  errorMessage?: string | null
  label?: string
  disabled?: boolean
}

export function TrackSelect({
  tracks,
  selectedTrackId,
  onSelect,
  isLoading = false,
  error = null,
  hasError = false,
  errorMessage = null,
  label = 'Траектория обучения',
  disabled = false
}: TrackSelectProps) {
  return (
    <div className="track-selector">
      {label && <label className="track-selector-label">{label}</label>}

      {isLoading ? (
        <div className="track-options-grid loading" role="status" aria-label="Загрузка траекторий">
          <div className="track-option-btn skeleton" />
          <div className="track-option-btn skeleton" />
        </div>
      ) : (
        <div
          className={`track-options-grid ${hasError ? 'has-error' : ''}`}
          role="radiogroup"
          aria-label={label}
        >
          {tracks.map((track, index) => {
            const isSelected = track.id === selectedTrackId
            const Icon = index === 0 ? BookOpen : index === 1 ? FlaskConical : GraduationCap

            return (
              <button
                key={track.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                title={track.title}
                className={`track-option-btn ${isSelected ? 'active' : ''}`}
                onClick={() => onSelect(track.id)}
              >
                <Icon size={18} className="track-btn-icon" />
                <span className="track-btn-title">{track.title}</span>
              </button>
            )
          })}
        </div>
      )}

      {hasError && errorMessage && (
        <small className="field-error" role="alert">
          {errorMessage}
        </small>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  )
}
