import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { BookOpen, Layers, LayoutDashboard, LogOut, Menu, UserRound } from 'lucide-react'
import { api, type User } from './api'
import { AuthPage } from './AuthPage'
import { CatalogPage, LessonPage, ProfilePage, TrackPage } from './StudentPages'
import { EditorPage, TestEditor } from './AdminPages'
import { AdminCurriculum } from './AdminCurriculum'

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '' }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; className?: string }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`button ${variant} ${className}`}>{children}</button>
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`input ${props.className || ''}`} /> }
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`input ${props.className || ''}`} /> }
export function Loading() { return <div className="notice">Загрузка…</div> }
export function ErrorState({ error }: { error: unknown }) { return <div className="notice error">{error instanceof Error ? error.message : 'Не удалось загрузить данные'}</div> }
export function Confirm({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) { return <div className="modal-backdrop"><div className="modal"><h3>{title}</h3><div className="row"><Button variant="danger" onClick={onConfirm}>Подтвердить</Button><Button variant="secondary" onClick={onCancel}>Отмена</Button></div></div></div> }
export function Notice({ text, kind = 'success' }: { text: string; kind?: 'success' | 'error' }) { return text ? <div role="status" className={`toast ${kind}`}>{text}</div> : null }

function Shell({ user, children, admin = false }: { user: User; children: React.ReactNode; admin?: boolean }) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const logout = async () => { await api('auth/logout/', 'POST'); qc.setQueryData(['me'], null); navigate('/login') }
  const links = admin ? [['/admin', 'Обзор', LayoutDashboard], ['/admin/curriculum', 'Учебная программа', Layers]] as const : [['/', 'Главная', LayoutDashboard], ['/catalog', 'Каталог', BookOpen], ['/profile', 'Профиль', UserRound]] as const
  return <div className="shell"><aside className={`sidebar ${open ? 'open' : ''}`}><Link className="brand" to={admin ? '/admin' : '/'}>AI<span>edu</span><small>Платформа знаний</small></Link><div className="side-label">{admin ? 'АДМИНИСТРИРОВАНИЕ' : 'ОБУЧЕНИЕ'}</div><nav>{links.map(([to, label, Icon]) => <Link key={to} onClick={() => setOpen(false)} className={location.pathname === to ? 'active' : ''} to={to}><Icon size={18}/>{label}</Link>)}</nav><div className="sidebar-foot"><div className="avatar">{(user.first_name || user.email)[0].toUpperCase()}</div><div className="user-meta"><strong>{user.first_name || user.email}</strong><small>{admin ? 'Администратор' : 'Студент'}</small></div><button title="Выйти" onClick={logout}><LogOut size={18}/></button></div></aside><div className="main-wrap"><header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)}><Menu size={22}/></button><span>{admin ? 'Панель управления' : 'Личный кабинет'}</span><div className="topbar-right"><span className="role-badge">{admin ? 'ADMIN' : 'STUDENT'}</span><span className="avatar small">{(user.first_name || user.email)[0].toUpperCase()}</span></div></header><main className="content">{children}</main></div></div>
}

function Home({ user }: { user: User }) { return <><div className="hero"><div><span className="eyebrow">НАЧНИТЕ УЧИТЬСЯ СЕГОДНЯ</span><h1>Знания, которые открывают возможности</h1><p>Выберите направление, изучайте уроки и проверяйте себя в тестах.</p><Link className="button primary" to="/catalog">Смотреть каталог →</Link></div><div className="hero-art"><BookOpen size={82}/></div></div><h2 className="section-title">Ваш учебный путь</h2><div className="card"><h3>Добро пожаловать, {user.first_name || 'студент'}!</h3><p>В каталоге доступны опубликованные образовательные траектории и уроки.</p><Link className="text-link" to="/catalog">Перейти к траекториям →</Link></div></> }
function AdminHome() { return <><div className="page-head"><div><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Управление обучением</h1><p>Создавайте траектории, собирайте уроки и публикуйте тесты.</p></div></div><div className="grid two"><Link to="/admin/curriculum" className="card action-card"><Layers/><h3>Учебная программа</h3><p>Траектории, модули и уроки в общей структуре.</p><span>Открыть →</span></Link><Link to="/admin/curriculum" className="card action-card"><BookOpen/><h3>Материалы и уроки</h3><p>Редактирование содержания и публикация уроков.</p><span>Открыть →</span></Link></div></> }

export default function App() {
  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api<User>('auth/me/').catch(() => null), staleTime: 60000 })
  useEffect(() => { fetch('/api/v1/csrf/', { credentials: 'include' }).catch(() => {}) }, [])
  if (isLoading) return <Loading />
  return <Routes>
    <Route path="/login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} /> : <AuthPage mode="login" />} />
    <Route path="/register" element={user ? <Navigate to="/" /> : <AuthPage mode="register" />} />
    <Route path="/" element={user ? <Shell user={user}><Home user={user}/></Shell> : <Navigate to="/login"/>}/>
    <Route path="/catalog" element={user ? <Shell user={user}><CatalogPage/></Shell> : <Navigate to="/login"/>}/>
    <Route path="/tracks/:id" element={user ? <Shell user={user}><TrackPage/></Shell> : <Navigate to="/login"/>}/>
    <Route path="/lessons/:id" element={user ? <Shell user={user}><LessonPage/></Shell> : <Navigate to="/login"/>}/>
    <Route path="/profile" element={user ? <Shell user={user}><ProfilePage user={user}/></Shell> : <Navigate to="/login"/>}/>
    <Route path="/admin" element={user?.role === 'ADMIN' ? <Shell user={user} admin><AdminHome/></Shell> : <Navigate to="/"/>}/>
    <Route path="/admin/curriculum" element={user?.role === 'ADMIN' ? <Shell user={user} admin><AdminCurriculum/></Shell> : <Navigate to="/"/>}/>
    <Route path="/admin/tracks" element={<Navigate to="/admin/curriculum" replace/>}/>
    <Route path="/admin/modules" element={<Navigate to="/admin/curriculum" replace/>}/>
    <Route path="/admin/lessons" element={<Navigate to="/admin/curriculum" replace/>}/>
    <Route path="/admin/lessons/:id/edit" element={user?.role === 'ADMIN' ? <Shell user={user} admin><EditorPage/></Shell> : <Navigate to="/"/>}/>
    <Route path="/admin/lessons/:id/test" element={user?.role === 'ADMIN' ? <Shell user={user} admin><TestEditor/></Shell> : <Navigate to="/"/>}/>
    <Route path="*" element={<Navigate to="/"/>}/>
  </Routes>
}
