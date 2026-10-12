import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { api, type User } from '../api'
import { updateSession } from '../session'
import { useI18n } from '../i18n'

export function AccountMenu({ user, admin = false, showProfile = true }: { user: User; admin?: boolean; showProfile?: boolean }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDetailsElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const logoutPending = useRef(false)
  const close = () => { if (ref.current) ref.current.open = false }
  useEffect(() => {
    const outside = (event: MouseEvent | TouchEvent) => { if (!ref.current?.contains(event.target as Node)) close() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  useEffect(close, [location.pathname])
  const logout = async () => {
    if (logoutPending.current) return
    logoutPending.current = true
    setIsLoggingOut(true)
    setError('')
    try {
      await api('auth/logout/', 'POST')
      await updateSession(qc, null)
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Не удалось выйти'))
      if (ref.current) ref.current.open = true
    } finally {
      logoutPending.current = false
      setIsLoggingOut(false)
    }
  }
  return <details ref={ref} className="user-menu">
    <summary aria-label={t('Меню пользователя')}><span className="avatar">{(user.first_name || user.email)[0].toUpperCase()}</span><span className="user-menu-name">{admin ? t('Администратор') : user.first_name || user.email}</span><ChevronDown size={15}/></summary>
    <div className="user-menu-panel"><span className="user-menu-email" title={user.email}>{user.email}</span>{showProfile && <Link to={admin ? '/admin/profile' : '/profile'} onClick={close}><UserRound size={16}/>{t('Профиль')}</Link>}<button type="button" disabled={isLoggingOut} onClick={() => { void logout() }}><LogOut size={16}/>{t(isLoggingOut ? 'Подождите…' : 'Выйти')}</button>{error && <p role="alert" className="field-error">{error}</p>}</div>
  </details>
}
