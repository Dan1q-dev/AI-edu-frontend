import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from 'lucide-react'
import { api } from './api'
import { AuthLayout } from './components/AuthLayout'
import { Button, Input } from './components/ui'
import { useI18n } from './i18n'
import { updateSession } from './session'

export function PasswordResetPage({ mode }: { mode: 'request' | 'confirm' }) {
  const { t } = useI18n()
  const { uid, token } = useParams<{ uid: string; token: string }>()
  const client = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const request = mode === 'request'
  useEffect(() => { setDone(false); setError(''); setPassword(''); setConfirm('') }, [uid, token])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!request && password !== confirm) { setError(t('Пароли не совпадают')); return }
    setBusy(true)
    try {
      if (request) await api('auth/password-reset/', 'POST', { email: email.trim() })
      else {
        await api('auth/password-reset/confirm/', 'POST', { uid, token, new_password: password })
        await updateSession(client, null)
      }
      setDone(true)
      setPassword(''); setConfirm('')
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t('Не удалось отправить запрос. Попробуйте ещё раз.')) }
    finally { setBusy(false) }
  }

  return <AuthLayout>
    <form className="auth-form card auth-recovery-form" onSubmit={submit}>
      <Link to="/login" className="auth-reset-link"><ArrowLeft size={16} aria-hidden="true"/>{t('Вернуться ко входу')}</Link>
      {done ? <div className="auth-recovery-result" role="status">
        <span className="auth-recovery-icon"><CheckCircle2 size={26} aria-hidden="true"/></span>
        <h2>{t(request ? 'Проверьте почту' : 'Пароль изменён')}</h2>
        <p>{t(request ? 'Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса пароля.' : 'Теперь вы можете войти с новым паролем.')}</p>
        {request && <small>{t('Письмо может попасть в папку «Спам». Если ссылка истекла, запросите новую.')}</small>}
        <Link className="button primary wide" to="/login">{t('Войти')}</Link>
        {request && <button type="button" className="auth-reset-link" onClick={() => { setDone(false); setError('') }}>{t('Отправить письмо ещё раз')}</button>}
      </div> : <>
        <span className="auth-recovery-icon">{request ? <Mail size={26} aria-hidden="true"/> : <KeyRound size={26} aria-hidden="true"/>}</span>
        <h2>{t(request ? 'Восстановление пароля' : 'Новый пароль')}</h2>
        <p>{t(request ? 'Введите email вашего аккаунта. Мы отправим ссылку для сброса пароля.' : 'Задайте новый пароль для вашего аккаунта AI Edu.')}</p>
        {request ? <label>Email<Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@university.edu" disabled={busy}/></label> : <>
          <label>{t('Новый пароль')}<Input type="password" autoComplete="new-password" required minLength={8} maxLength={4096} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
          <label>{t('Повторите пароль')}<Input type="password" autoComplete="new-password" required minLength={8} maxLength={4096} value={confirm} onChange={event => setConfirm(event.target.value)} disabled={busy}/></label>
        </>}
        {error && <div className="auth-recovery-error" role="alert">{error}{!request && <Link to="/forgot-password">{t('Запросить новую ссылку')}</Link>}</div>}
        <Button type="submit" className="wide" disabled={busy}>{t(busy ? 'Подождите…' : request ? 'Отправить ссылку' : 'Сохранить новый пароль')}</Button>
      </>}
    </form>
  </AuthLayout>
}
