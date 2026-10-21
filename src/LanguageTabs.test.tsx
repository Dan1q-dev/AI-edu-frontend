import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider, LanguageTabs, useI18n } from './i18n'

afterEach(() => { cleanup(); localStorage.clear() })

test('reference language tabs keep the existing locale state and translations', () => {
  function Copy() {
    const { t } = useI18n()
    return <h2>{t('Введите данные учетной записи')}</h2>
  }
  render(<I18nProvider><LanguageTabs/><Copy/></I18nProvider>)
  expect(screen.getByRole('button', { name: 'Русский' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(screen.getByRole('heading', { name: 'Enter your account details' })).toBeTruthy()
  expect(localStorage.getItem('ai-edu-locale')).toBe('en')
  fireEvent.click(screen.getByRole('button', { name: 'Қазақша' }))
  expect(screen.getByRole('heading', { name: 'Тіркелгі деректерін енгізіңіз' })).toBeTruthy()
  expect(document.documentElement.lang).toBe('kk')
})
