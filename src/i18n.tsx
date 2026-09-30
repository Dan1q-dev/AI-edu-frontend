import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Languages } from 'lucide-react'
import ruMessages from './locales/ru.json'
import kzMessages from './locales/kz.json'
import enMessages from './locales/en.json'

export type Locale = 'ru' | 'kz' | 'en'
const dictionaries: Record<Locale, Record<string, string>> = {
  ru: ruMessages,
  kz: kzMessages,
  en: enMessages,
}

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
  return <label className={`language-select ${compact ? 'compact' : ''}`}>
    {!compact && <span>{t('Язык интерфейса')}</span>}
    {compact && <Languages className="language-select-icon" size={16} aria-hidden="true"/>}
    <select aria-label={t('Язык интерфейса')} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      <option value="ru">Русский</option><option value="kz">Қазақша</option><option value="en">English</option>
    </select>
  </label>
}
