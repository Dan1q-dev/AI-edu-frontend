import { useState } from 'react'
import { BookOpen, ChevronDown, GraduationCap, LayoutDashboard, LogOut, Menu, UserRound, X } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api, type User } from '../api'

export function MainLayout({ user, children }: { user: User; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user.role === 'ADMIN'

  const logout = async () => {
    try {
      await api('auth/logout/', 'POST')
      queryClient.setQueryData(['me'], null)
      navigate('/login')
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Не удалось выйти')
    }
  }

  const navItems = [
    { to: '/', label: 'Моё обучение', icon: GraduationCap, end: true },
    { to: '/catalog', label: 'Каталог', icon: BookOpen },
    { to: '/profile', label: 'Профиль', icon: UserRound },
  ]

  return <div className="main-layout">
    <header className="main-header">
      <div className="main-header-inner">
        <Link to="/" className="brand" aria-label="AI Edu — на главную">AI<span>edu</span></Link>
        <button className="icon-button main-nav-toggle" aria-label={menuOpen ? 'Закрыть навигацию' : 'Открыть навигацию'} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Основная навигация">
          {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `main-nav-link ${isActive ? 'active' : ''}`}><Icon size={17}/>{label}</NavLink>)}
          {isAdmin && <NavLink to="/admin/curriculum" onClick={() => setMenuOpen(false)} className={({ isActive }) => `main-nav-link admin-link ${location.pathname.startsWith('/admin') || isActive ? 'active' : ''}`}><LayoutDashboard size={17}/>Панель администратора</NavLink>}
        </nav>
        <details className="user-menu">
          <summary aria-label="Меню пользователя"><span className="avatar">{(user.first_name || user.email)[0].toUpperCase()}</span><span className="user-menu-name">{user.first_name || user.email}</span><ChevronDown size={15}/></summary>
          <div className="user-menu-panel"><span className="user-menu-email">{user.email}</span><Link to="/profile" onClick={() => setMenuOpen(false)}>Профиль</Link><button onClick={logout}><LogOut size={16}/>Выйти</button></div>
        </details>
      </div>
    </header>
    <main className="main-content">
      {logoutError && <div className="toast error" role="alert">{logoutError}</div>}
      {children}
    </main>
  </div>
}
