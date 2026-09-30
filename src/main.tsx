import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './style.css'
import './redesign.css'
import { I18nProvider } from './i18n'

createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })}><HashRouter><App /></HashRouter></QueryClientProvider></I18nProvider></React.StrictMode>)
