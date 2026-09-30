import { useEffect, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from './api'

function csrfToken() {
  const value = document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1]
  return value ? decodeURIComponent(value) : ''
}

export function LectureProgress({ itemId, courseId, savedPercent, children }: {
  itemId: string; courseId: string; savedPercent: number; children: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    let maximum = savedPercent
    let lastSent = savedPercent
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false

    const save = (keepalive = false) => {
      if (maximum <= lastSent) return
      lastSent = maximum
      if (keepalive) {
        fetch(`/api/v1/items/${encodeURIComponent(itemId)}/progress/`, {
          method: 'PATCH', credentials: 'include', keepalive: true,
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
          body: JSON.stringify({ progress_percent: maximum }),
        }).then(response => { if (response.ok) queryClient.invalidateQueries({ queryKey: ['course-progress', courseId] }) }).catch(() => {})
      } else {
        api(`items/${itemId}/progress/`, 'PATCH', { progress_percent: maximum })
          .then(() => queryClient.invalidateQueries({ queryKey: ['course-progress', courseId] }))
          .catch(() => { lastSent = Math.min(lastSent, savedPercent) })
      }
    }
    const measure = () => {
      const element = contentRef.current
      if (!element || disposed) return
      const rect = element.getBoundingClientRect()
      const viewed = Math.max(0, Math.min(100, Math.round(100 * (window.innerHeight - rect.top) / Math.max(rect.height, 1))))
      maximum = Math.max(maximum, viewed)
      if (maximum - lastSent >= 5 || maximum === 100 && lastSent < 100) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => save(), 700)
      }
    }
    const onPageHide = () => save(true)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('pagehide', onPageHide)
    const frame = requestAnimationFrame(measure)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pagehide', onPageHide)
      save(true)
    }
  }, [itemId, courseId, savedPercent, queryClient])

  return <div ref={contentRef}>{children}</div>
}
