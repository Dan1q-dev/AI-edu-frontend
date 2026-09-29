import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react'
import {
  ChevronDown,
  Check,
  Compass,
  Sparkles,
  Layers,
  GraduationCap,
  Search,
  X
} from 'lucide-react'
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
  placeholder?: string
  disabled?: boolean
  id?: string
}

// Consistent visual tones for tracks in the design system
export const TRACK_THEMES = [
  {
    themeClass: 'theme-indigo',
    Icon: Compass,
    accent: '#3b66de',
    bg: '#edf2ff',
    border: '#d5e0fb'
  },
  {
    themeClass: 'theme-teal',
    Icon: Sparkles,
    accent: '#1d8059',
    bg: '#e6f6f0',
    border: '#c4ebd9'
  },
  {
    themeClass: 'theme-violet',
    Icon: Layers,
    accent: '#8a4ea8',
    bg: '#f6ecfa',
    border: '#ebd2f5'
  },
  {
    themeClass: 'theme-amber',
    Icon: GraduationCap,
    accent: '#b45309',
    bg: '#fef4e8',
    border: '#f9dfb8'
  }
]

function getTrackTheme(index: number) {
  return TRACK_THEMES[Math.abs(index) % TRACK_THEMES.length]
}

function pluralizeTracks(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'направление'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'направления'
  return 'направлений'
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
  placeholder = 'Выберите траекторию обучения',
  disabled = false,
  id: customId
}: TrackSelectProps) {
  const generatedId = useId()
  const componentId = customId || generatedId
  const listboxId = `${componentId}-listbox`
  const labelId = `${componentId}-label`

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const optionsListRef = useRef<HTMLDivElement>(null)

  const selectedIndex = tracks.findIndex(t => t.id === selectedTrackId)
  const selectedTrack = selectedIndex !== -1 ? tracks[selectedIndex] : null
  const selectedTheme = selectedIndex !== -1 ? getTrackTheme(selectedIndex) : null

  // Filtered tracks when search query is active
  const filteredTracks = tracks.filter(track => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      track.title.toLowerCase().includes(q) ||
      (track.description && track.description.toLowerCase().includes(q))
    )
  })

  // Handle outside clicks to close dropdown
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
        setFocusedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  // Focus search input or option when dropdown opens
  useEffect(() => {
    if (isOpen) {
      if (tracks.length > 3 && searchInputRef.current) {
        searchInputRef.current.focus()
      }
      if (selectedIndex !== -1) {
        setFocusedIndex(selectedIndex)
      } else {
        setFocusedIndex(0)
      }
    } else {
      setSearchQuery('')
      setFocusedIndex(-1)
    }
  }, [isOpen, tracks.length, selectedIndex])

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionsListRef.current) {
      const optionElements = optionsListRef.current.querySelectorAll<HTMLElement>('[role="option"]')
      const targetElement = optionElements[focusedIndex]
      if (targetElement && typeof targetElement.scrollIntoView === 'function') {
        targetElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [focusedIndex, isOpen])

  const toggleDropdown = () => {
    if (disabled || isLoading) return
    setIsOpen(prev => !prev)
  }

  const handleSelect = (track: Track) => {
    onSelect(track.id)
    setIsOpen(false)
    setSearchQuery('')
    setFocusedIndex(-1)
    triggerRef.current?.focus()
  }

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      }
    }
  }

  const handleListKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => (prev < filteredTracks.length - 1 ? prev + 1 : 0))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : filteredTracks.length - 1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedIndex >= 0 && focusedIndex < filteredTracks.length) {
        handleSelect(filteredTracks[focusedIndex])
      }
      return
    }

    if (e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  return (
    <div className="track-select-field" ref={containerRef}>
      <div className="track-select-label-row">
        <label id={labelId} className="track-select-label">
          {label}
        </label>
        {tracks.length > 0 && !isLoading && (
          <span className="track-select-hint">
            {tracks.length} {pluralizeTracks(tracks.length)}
          </span>
        )}
      </div>

      <div className="track-select-control">
        {isLoading ? (
          <div className="track-select-skeleton" role="status" aria-label="Загрузка списка траекторий">
            <div className="track-select-skeleton-icon" />
            <div className="track-select-skeleton-lines">
              <div className="track-select-skeleton-line short" />
              <div className="track-select-skeleton-line long" />
            </div>
          </div>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className={`track-select-trigger ${isOpen ? 'is-open' : ''} ${hasError ? 'has-error' : ''}`}
            onClick={toggleDropdown}
            onKeyDown={handleTriggerKeyDown}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-labelledby={`${labelId} ${componentId}-value`}
            aria-controls={isOpen ? listboxId : undefined}
            disabled={disabled}
            id={`${componentId}-trigger`}
          >
            {selectedTrack && selectedTheme ? (
              <>
                <div className={`track-select-badge ${selectedTheme.themeClass}`}>
                  <selectedTheme.Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="track-select-info" id={`${componentId}-value`}>
                  <span className="track-select-eyebrow">ВЫБРАННАЯ ТРАЕКТОРИЯ</span>
                  <span className="track-select-selected-title">{selectedTrack.title}</span>
                  {selectedTrack.description && (
                    <span className="track-select-selected-desc">{selectedTrack.description}</span>
                  )}
                </div>
                <div className="track-select-actions">
                  <span className="track-select-change-pill">Сменить</span>
                  <div className={`track-select-chevron ${isOpen ? 'is-open' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="track-select-badge neutral">
                  <GraduationCap size={20} strokeWidth={2} />
                </div>
                <div className="track-select-info" id={`${componentId}-value`}>
                  <span className="track-select-placeholder">{placeholder}</span>
                  <span className="track-select-helper">Определяет стартовую программу курсов</span>
                </div>
                <div className="track-select-actions">
                  <div className={`track-select-chevron ${isOpen ? 'is-open' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </div>
              </>
            )}
          </button>
        )}

        {isOpen && (
          <div
            className="track-select-popover"
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            onKeyDown={handleListKeyDown}
          >
            <div className="track-select-menu-header">
              <span className="track-select-menu-title">Доступные направления</span>
              <span className="track-select-count-badge">
                {filteredTracks.length} {pluralizeTracks(filteredTracks.length)}
              </span>
            </div>

            {tracks.length > 3 && (
              <div className="track-select-search-wrap">
                <Search size={15} className="track-select-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="track-select-search-input"
                  placeholder="Поиск направления…"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                    setFocusedIndex(0)
                  }}
                  onKeyDown={handleListKeyDown}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="track-select-search-clear"
                    onClick={() => {
                      setSearchQuery('')
                      searchInputRef.current?.focus()
                    }}
                    aria-label="Очистить поиск"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            <div className="track-select-options-list" ref={optionsListRef}>
              {filteredTracks.length === 0 ? (
                <div className="track-select-empty">
                  <p>Ничего не найдено по запросу «{searchQuery}»</p>
                </div>
              ) : (
                filteredTracks.map((track, index) => {
                  const originalIndex = tracks.findIndex(t => t.id === track.id)
                  const theme = getTrackTheme(originalIndex >= 0 ? originalIndex : index)
                  const isSelected = track.id === selectedTrackId
                  const isFocused = index === focusedIndex

                  return (
                    <div
                      key={track.id}
                      role="option"
                      aria-selected={isSelected}
                      className={`track-select-option ${isSelected ? 'is-selected' : ''} ${
                        isFocused ? 'is-focused' : ''
                      }`}
                      onClick={() => handleSelect(track)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      tabIndex={-1}
                    >
                      <div className={`track-select-option-badge ${theme.themeClass}`}>
                        <theme.Icon size={18} strokeWidth={2.2} />
                      </div>

                      <div className="track-select-option-body">
                        <div className="track-select-option-header">
                          <span className="track-select-option-title">{track.title}</span>
                          {track.is_system && (
                            <span className="track-select-tag">Базовая</span>
                          )}
                        </div>
                        {track.description && (
                          <p className="track-select-option-desc">{track.description}</p>
                        )}
                      </div>

                      {isSelected && (
                        <div className="track-select-option-check" aria-hidden="true">
                          <Check size={13} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="track-select-menu-footer">
              💡 Направление можно изменить в профиле в любой момент
            </div>
          </div>
        )}
      </div>

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
