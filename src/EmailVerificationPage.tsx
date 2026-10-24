import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { api } from './api'
import { AuthLayout } from './components/AuthLayout'
import { Button, Input } from './components/ui'
import { useI18n } from './i18n'

export function EmailVerificationPage({ mode }: { mode: 'verify' | 'resend' }) {
  const { t } = useI18n()
  const { token } = useParams<{ token: string }>()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const verify = mode === 'verify'
  useEffect(() => { setDone(false); setError('') }, [token])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError(''); setBusy(true)
    try {
      await api(verify ? 'auth/verify-email/' : 'auth/verify-email/resend/', 'POST', verify ? { token } : { email: email.trim() })
      setDone(true)
    } catch (cause) { setError(cause instanceof Error ? t(cause.message) : t('Не удалось отправить запрос. Попробуйте ещё раз.')) }
    finally { setBusy(false) }
  }

  return <AuthLayout>
    <form className="auth-form card auth-recovery-form" onSubmit={submit}>
      <Link to="/login" className="auth-reset-link"><ArrowLeft size={16} aria-hidden="true"/>{t('Вернуться ко входу')}</Link>
      <span className="auth-recovery-icon">{done ? <CheckCircle2 size={26} aria-hidden="true"/> : <Mail size={26} aria-hidden="true"/>}</span>
      {done ? <div role="status" className="auth-recovery-result">
        <h2>{t(verify ? 'Email подтверждён' : 'Проверьте почту')}</h2>
        <p>{t(verify ? 'Теперь вы можете войти в аккаунт.' : 'Если email ожидает подтверждения, мы отправили новое письмо.')}</p>
        <Link className="button primary wide" to="/login">{t('Войти')}</Link>
      </div> : <>
        <h2>{t(verify ? 'Подтвердите email' : 'Письмо подтверждения')}</h2>
        <p>{t(verify ? 'Подтвердите адрес электронной почты, чтобы начать обучение в AI Edu.' : 'Введите email, указанный при регистрации. Мы отправим новую ссылку подтверждения.')}</p>
        {!verify && <label>Email<Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>}
        {error && <div role="alert" className="auth-recovery-error">{error}{verify && <Link to="/resend-verification">{t('Отправить письмо ещё раз')}</Link>}</div>}
        <Button className="wide" type="submit" disabled={busy}>{t(busy ? 'Подождите…' : verify ? 'Подтвердить email' : 'Отправить письмо подтверждения')}</Button>
      </>}
    </form>
  </AuthLayout>
}
