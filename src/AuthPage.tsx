import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { api, apiAll, type Track, type User } from './api'
import { Button, Input, Loading, Notice } from './components/ui'

const schema = z.object({ email: z.email('Введите корректный email'), password: z.string().min(8, 'Минимум 8 символов'), first_name: z.string().optional(), last_name: z.string().optional(), learning_track: z.number().optional() })
type Form = z.infer<typeof schema>
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })
  const tracks = useQuery({ queryKey: ['registration-tracks'], queryFn: () => apiAll<Track>('tracks/'), enabled: mode === 'register' })
  const [error, setError] = useState('')
  const qc = useQueryClient(), navigate = useNavigate()
  const submit = async (values: Form) => {
    setError('')
    if (mode === 'register' && !values.learning_track) { setError('Выберите траекторию обучения'); return }
    try {
      const user = await api<User>(`auth/${mode}/`, 'POST', mode === 'register' ? values : { email: values.email, password: values.password })
      qc.setQueryData(['me'], user)
      navigate(user.role === 'ADMIN' ? '/admin' : '/')
    } catch (e) { setError((e as Error).message) }
  }
  return <div className="auth-page"><div className="auth-side"><Link to="/" className="brand">AI<span>edu</span></Link><div><div className="auth-icon"><BookOpen size={46}/></div><h1>Обучение начинается здесь.</h1><p>Создавайте свой путь в мире технологий и гуманитарных наук.</p></div><small>© AI Edu · Образовательная платформа</small></div><div className="auth-form-wrap"><form className="auth-form card" onSubmit={handleSubmit(submit)}><span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span><h2>{mode === 'login' ? 'Вход в аккаунт' : 'Создать аккаунт'}</h2><p>{mode === 'login' ? 'Продолжите обучение там, где остановились.' : 'Начните изучать новые траектории.'}</p>{mode === 'register' && <><div className="row"><label>Имя<Input {...register('first_name')} /></label><label>Фамилия<Input {...register('last_name')} /></label></div><label>Траектория обучения{tracks.isLoading ? <Loading/> : <select className="input" defaultValue="" {...register('learning_track', { valueAsNumber: true })}><option value="" disabled>Выберите траекторию</option>{tracks.data?.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}</select>}<small className="field-error">{tracks.error ? 'Не удалось загрузить траектории' : ''}</small></label></>}<label>Email<Input type="email" autoComplete="email" {...register('email')}/><small className="field-error">{errors.email?.message}</small></label><label>Пароль<Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')}/><small className="field-error">{errors.password?.message}</small></label><Notice text={error} kind="error"/><Button type="submit" disabled={isSubmitting || (mode === 'register' && (tracks.isLoading || !tracks.data?.length))} className="wide">{isSubmitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Button><div className="auth-switch">{mode === 'login' ? <>Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></> : <>Уже есть аккаунт? <Link to="/login">Войти</Link></>}</div></form></div></div>
}
