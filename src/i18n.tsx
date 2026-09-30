import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Languages } from 'lucide-react'
import ruMessages from './locales/ru.json'
import kzMessages from './locales/kz.json'
import enMessages from './locales/en.json'

export type Locale = 'ru' | 'kz' | 'en'
const dictionaries: Record<Locale, Record<string, string>> = {
  ru: ruMessages,
  kz: kzMessages,
  en: enMessages,
}

const languages: { code: Locale; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'kz', label: 'Қазақша' },
  { code: 'en', label: 'English' },
]

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string }
const I18nContext = createContext<I18nValue | null>(null)

function storedLocale(): Locale {
  const saved = localStorage.getItem('ai-edu-locale')
  if (saved === 'kz' || saved === 'kk') return 'kz'
  return saved === 'en' ? 'en' : 'ru'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrentLocale] = useState<Locale>(storedLocale)
  const setLocale = (next: Locale) => {
    localStorage.setItem('ai-edu-locale', next)
    setCurrentLocale(next)
  }
  useEffect(() => {
    document.documentElement.lang = locale === 'kz' ? 'kk' : locale
    document.title = dictionaries[locale]['AI Edu — образовательная платформа'] ?? 'AI Edu'
  }, [locale])
  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t: key => dictionaries[locale][key] ?? key }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  return value ?? { locale: 'ru', setLocale: () => {}, t: (key: string) => dictionaries.ru[key] ?? key }
}

export function translateCurrentLocale(key: string) {
  const locale = storedLocale()
  return dictionaries[locale][key] ?? key
}

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const current = languages.find(item => item.code === locale) ?? languages[0]

  return (
    <div className={`language-select ${compact ? 'compact' : ''}`} ref={containerRef}>
      {!compact && <span className="language-select-label">{t('Язык интерфейса')}</span>}
      <button
        type="button"
        className="language-select-trigger"
        aria-label={t('Язык интерфейса')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Languages className="language-select-icon" size={15} aria-hidden="true" />
        <span className="language-select-text">{current.label}</span>
        <ChevronDown size={14} className={`language-select-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="language-select-menu" role="listbox" aria-label={t('Язык интерфейса')}>
          {languages.map(item => {
            const isSelected = item.code === locale
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`language-select-option ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setLocale(item.code)
                  setOpen(false)
                }}
              >
                <span>{item.label}</span>
                {isSelected && <Check size={14} className="language-select-check" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
