import { useEffect } from 'react'
import { useI18n } from './i18n'

export function useLeaveWarning(dirty: boolean, onNavigate?: (destination: string) => void) {
  const { t } = useI18n()
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
      const currentRoute = window.location.pathname + window.location.search + window.location.hash
      const nextRoute = anchor.pathname + anchor.search + anchor.hash
      if (anchor.origin === window.location.origin && nextRoute !== currentRoute && onNavigate) {
        event.preventDefault(); event.stopPropagation()
        onNavigate(anchor.hash.startsWith('#/') ? anchor.hash.slice(1) : nextRoute)
      } else if (anchor.origin === window.location.origin && nextRoute !== currentRoute && !window.confirm(t('Есть несохранённые изменения. Покинуть страницу?'))) {
        event.preventDefault(); event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true) }
  }, [dirty, t, onNavigate])
}
