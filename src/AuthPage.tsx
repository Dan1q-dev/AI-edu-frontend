import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, Mail, UserPlus } from 'lucide-react'
import { api, ApiError, type User } from './api'
import { updateSession } from './session'
import { Button, Input, Notice } from './components/ui'
import { useI18n } from './i18n'
import { AuthLayout } from './components/AuthLayout'

const makeSchema = (t: (key: string) => string, mode: 'login' | 'register') => z.object({
  email: z.string().trim().pipe(z.email(t('Введите корректный email'))),
  password: z.string().min(mode === 'register' ? 8 : 1, t(mode === 'register' ? 'Минимум 8 символов' : 'Введите пароль')),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  learning_track: z.number().optional()
})

type Form = z.infer<ReturnType<typeof makeSchema>>

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n()
  const schema = useMemo(() => makeSchema(t, mode), [t, mode])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<Form>({
    resolver: zodResolver(schema)
  })

  const [error, setError] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [unverified, setUnverified] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const submit = async (values: Form) => {
    setError('')
    setUnverified(false)
    try {
      const user = await api<User & { verification_required?: boolean }>(
        `auth/${mode}/`,
        'POST',
        mode === 'register'
          ? values
          : { email: values.email, password: values.password }
      )
      if (mode === 'register') {
        setVerificationEmail(user.email)
        return
      }
      await updateSession(qc, user)
      navigate(user.role === 'ADMIN' ? '/admin/curriculum' : '/', { replace: true })
    } catch (e) {
      setUnverified(e instanceof ApiError && e.code === 'email_not_verified')
      setError(t((e as Error).message))
    }
  }

  return (
    <AuthLayout>
      {verificationEmail ? <div className="auth-form card auth-recovery-result" role="status">
        <span className="auth-recovery-icon"><Mail size={26} aria-hidden="true"/></span>
        <h2>{t('Подтвердите email')}</h2>
        <p>{t('Мы отправили письмо с подтверждением на')} <strong>{verificationEmail}</strong>. {t('Перейдите по ссылке из письма, чтобы войти в аккаунт.')}</p>
        <small>{t('Если письма нет, проверьте папку «Спам».')}</small>
        <Link className="button primary wide" to="/login">{t('Вернуться ко входу')}</Link>
        <Link className="auth-reset-link" to={`/resend-verification?email=${encodeURIComponent(verificationEmail)}`}>{t('Отправить письмо ещё раз')}</Link>
      </div> :
        <form
          className={`auth-form card ${mode === 'register' ? 'auth-form-register' : ''}`}
          onSubmit={handleSubmit(submit)}
        >
          <nav className="auth-mode" aria-label={t('Режим входа')}>
            <Link to="/login" aria-current={mode === 'login' ? 'page' : undefined}>{t('Войти')}</Link>
            <Link to="/register" aria-current={mode === 'register' ? 'page' : undefined}>{t('Создать аккаунт')}</Link>
          </nav>
          <h2>{mode === 'login' ? t('Продолжить обучение') : t('Новый участник')}</h2>
          <p>
            {mode === 'login'
              ? t('Введите данные учетной записи')
              : t('Начните изучать новые траектории.')}
          </p>

          {mode === 'register' && (
            <div className="row">
              <label>
                {t('Имя')}
                <Input {...register('first_name')} placeholder={t('Имя')} />
              </label>
              <label>
                {t('Фамилия')}
                <Input {...register('last_name')} placeholder={t('Фамилия')} />
              </label>
            </div>
          )}

          <label>
            Email
            <Input
              type="email"
              autoComplete="email"
              placeholder="name@university.edu"
              {...register('email')}
            />
            <small className="field-error">{errors.email?.message}</small>
          </label>

          <label>
            {t('Пароль')}
            <Input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={t(mode === 'register' ? 'Минимум 8 символов' : 'Введите пароль')}
              {...register('password')}
            />
            <small className="field-error">{errors.password?.message}</small>
          </label>

          {mode === 'login' && <Link className="auth-reset-link" to="/forgot-password">{t('Забыли пароль?')}</Link>}
          {unverified && <Link className="auth-reset-link" to="/resend-verification">{t('Отправить письмо подтверждения')}</Link>}

          <Notice text={error} onDismiss={() => setError('')} kind="error" />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="wide"
          >
            {mode === 'login' ? <LogIn size={18} aria-hidden="true"/> : <UserPlus size={18} aria-hidden="true"/>}
            {isSubmitting
              ? t('Подождите…')
              : mode === 'login'
              ? t('Войти')
              : t('Зарегистрироваться')}
          </Button>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                {t('Нет аккаунта?')} <Link to="/register">{t('Зарегистрироваться')}</Link>
              </>
            ) : (
              <>
                {t('Уже есть аккаунт?')} <Link to="/login">{t('Войти')}</Link>
              </>
            )}
          </div>
        </form>}
    </AuthLayout>
  )
}
