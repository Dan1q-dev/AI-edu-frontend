import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { api, type User } from './api'
import { Button, Input, Notice } from './App'

const schema = z.object({ email: z.email('Введите корректный email'), password: z.string().min(8, 'Минимум 8 символов'), first_name: z.string().optional(), last_name: z.string().optional() })
type Form = z.infer<typeof schema>
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })
  const [error, setError] = useState('')
  const qc = useQueryClient(), navigate = useNavigate()
  const submit = async (values: Form) => {
    setError('')
    try {
      const user = await api<User>(`auth/${mode}/`, 'POST', values)
      qc.setQueryData(['me'], user)
      navigate(user.role === 'ADMIN' ? '/admin' : '/')
    } catch (e) { setError((e as Error).message) }
  }
  return <div className="auth-page"><div className="auth-side"><Link to="/" className="brand">AI<span>edu</span></Link><div><div className="auth-icon"><BookOpen size={46}/></div><h1>Обучение начинается здесь.</h1><p>Создавайте свой путь в мире технологий и гуманитарных наук.</p></div><small>© AI Edu · Образовательная платформа</small></div><div className="auth-form-wrap"><form className="auth-form card" onSubmit={handleSubmit(submit)}><span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</span><h2>{mode === 'login' ? 'Вход в аккаунт' : 'Создать аккаунт'}</h2><p>{mode === 'login' ? 'Продолжите обучение там, где остановились.' : 'Начните изучать новые направления.'}</p>{mode === 'register' && <div className="row"><label>Имя<Input {...register('first_name')} /></label><label>Фамилия<Input {...register('last_name')} /></label></div>}<label>Email<Input type="email" autoComplete="email" {...register('email')}/><small className="field-error">{errors.email?.message}</small></label><label>Пароль<Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password')}/><small className="field-error">{errors.password?.message}</small></label><Notice text={error} kind="error"/><Button type="submit" disabled={isSubmitting} className="wide">{isSubmitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Button><div className="auth-switch">{mode === 'login' ? <>Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></> : <>Уже есть аккаунт? <Link to="/login">Войти</Link></>}</div></form></div></div>
}
