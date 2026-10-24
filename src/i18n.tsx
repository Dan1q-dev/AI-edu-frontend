import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Languages } from 'lucide-react'
import { Select } from './components/Select'
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

export function LanguageTabs() {
  const { locale, setLocale, t } = useI18n()
  const shortLabels: Record<Locale, string> = { ru: 'РУ', kz: 'ҚАЗ', en: 'EN' }
  return <div className="language-tabs" role="group" aria-label={t('Язык интерфейса')}>
    {languages.map(language => <button key={language.code} type="button" aria-label={language.label} title={language.label}
      aria-pressed={locale === language.code} onClick={() => setLocale(language.code)}>{shortLabels[language.code]}</button>)}
  </div>
}

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n()
  return <div className={`language-select ${compact ? 'compact' : ''}`}>
    {!compact && <span className="language-select-label">{t('Язык интерфейса')}</span>}
    <Select compact className="language-select-trigger" aria-label={t('Язык интерфейса')}
      leadingIcon={<Languages size={15}/>} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
      {languages.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
    </Select>
  </div>
}
