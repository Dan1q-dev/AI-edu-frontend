import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LanguageTabs, useI18n } from '../i18n'

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return <div className="auth-page">
    <div className="auth-language"><LanguageTabs/></div>
    <div className="auth-side">
      <Link to="/" className="auth-brand" aria-label="AI Edu">
        <span className="atlas-brand-mark" aria-hidden="true">AI</span>
        <span>{t('Исследовательский прототип')}</span>
      </Link>
      <div className="auth-product-copy">
        <p className="eyebrow">{t('Персонализированное обучение преподавателей')}</p>
        <h1>AI Edu<span aria-hidden="true"> /</span></h1>
        <p>{t('Учебная траектория меняется после каждого модуля на основе теста, практики, ошибок и освоенных компетенций.')}</p>
      </div>
      <small>© AI Edu · {t('Образовательная платформа')}</small>
    </div>
    <div className="auth-form-wrap">{children}</div>
  </div>
}
