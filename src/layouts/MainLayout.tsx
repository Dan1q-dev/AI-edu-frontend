import { useState, useRef, useEffect } from 'react'
import { BookOpen, ChevronDown, GraduationCap, LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api, type User } from '../api'
import { LanguageSelect, useI18n } from '../i18n'

export function MainLayout({ user, children }: { user: User; children: ReactNode }) {
  const [logoutError, setLogoutError] = useState('')
  const userMenuRef = useRef<HTMLDetailsElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user.role === 'ADMIN'
  const { t } = useI18n()

  const closeUserMenu = () => {
    if (userMenuRef.current?.open) {
      userMenuRef.current.open = false
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (userMenuRef.current?.open && !userMenuRef.current.contains(event.target as Node)) {
        userMenuRef.current.open = false
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && userMenuRef.current?.open) {
        userMenuRef.current.open = false
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
  }, [])

  useEffect(() => {
    closeUserMenu()
  }, [location.pathname])

  const logout = async () => {
    try {
      await api('auth/logout/', 'POST')
      queryClient.setQueryData(['me'], null)
      navigate('/login')
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : t('Не удалось выйти'))
    }
  }

  const navItems = [
    { to: '/', label: t('Моё обучение'), icon: GraduationCap, end: true },
    { to: '/catalog', label: t('Каталог'), icon: BookOpen },
    { to: '/profile', label: t('Профиль'), icon: UserRound },
  ]

  return <div className="main-layout">
    <header className="main-header">
      <div className="main-header-inner">
        <Link to="/" className="brand" aria-label={t('AI Edu — на главную')}>AI<span>edu</span></Link>
        <nav className="main-nav" aria-label={t('Основная навигация')}>
          {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `main-nav-link ${isActive ? 'active' : ''}`}><Icon size={17}/>{label}</NavLink>)}
          {isAdmin && <NavLink to="/admin/curriculum" className={({ isActive }) => `main-nav-link admin-link ${location.pathname.startsWith('/admin') || isActive ? 'active' : ''}`}><LayoutDashboard size={17}/>{t('Панель администратора')}</NavLink>}
        </nav>
        <LanguageSelect compact/>
        <details ref={userMenuRef} className="user-menu">
          <summary aria-label={t('Меню пользователя')}><span className="avatar">{(user.first_name || user.email)[0].toUpperCase()}</span><span className="user-menu-name">{user.first_name || user.email}</span><ChevronDown size={15}/></summary>
          <div className="user-menu-panel"><span className="user-menu-email" title={user.email}>{user.email}</span><Link to="/profile" onClick={closeUserMenu}>{t('Профиль')}</Link><button onClick={() => { closeUserMenu(); logout() }}><LogOut size={16}/>{t('Выйти')}</button></div>
        </details>
      </div>
    </header>
    <main className="main-content">
      {logoutError && <div className="toast error" role="alert">{logoutError}</div>}
      {children}
    </main>
  </div>
}
