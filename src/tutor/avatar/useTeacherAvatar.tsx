import { useEffect, useRef, useState } from 'react'
import { Square } from 'lucide-react'
import type { AvatarPacket } from '../KevinAvatar'
import type { TeacherScene } from './TeacherScene'
import { StreamPlayback } from './stream-playback.mjs'

type Configuration = { enabled: boolean; model_url?: string; expires_at?: number }
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')

export function useTeacherAvatar(authorized: boolean, onError: (message: string) => void, onStop: () => void) {
  const [config, setConfig] = useState<Configuration | null>(null)
  const [ready, setReady] = useState(false)
  const [active, setActive] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<TeacherScene | null>(null)
  const context = useRef<AudioContext | null>(null)
  const player = useRef<StreamPlayback | null>(null)
  const activeRef = useRef(false)
  const handlers = useRef({ onError, onStop })
  handlers.current = { onError, onStop }
  const available = !!config?.enabled && !!config.model_url
  if (!player.current) player.current = new StreamPlayback(() => context.current)

  useEffect(() => {
    if (!authorized) return
    const abort = new AbortController()
    let expiry: ReturnType<typeof setTimeout> | undefined
    void fetch('/api/v1/tutor/avatar/config/', { credentials: 'same-origin', signal: abort.signal })
      .then(async response => response.ok ? response.json() as Promise<Configuration> : null)
      .then(value => {
        if (abort.signal.aborted || !value?.enabled || typeof value.model_url !== 'string' || !value.model_url.startsWith('/api/v1/tutor/avatar/model/')) return
        if (typeof value.expires_at !== 'number' || value.expires_at * 1000 <= Date.now()) return
        setConfig(value)
        expiry = setTimeout(() => {
          player.current?.reset(); scene.current?.reset()
          setConfig(null); setReady(false); setActive(false)
          handlers.current.onStop()
        }, Math.min(value.expires_at * 1000 - Date.now(), 2147483647))
      }).catch(() => { /* Optional avatar availability must not break text tutoring. */ })
    return () => { abort.abort(); clearTimeout(expiry) }
  }, [authorized])

  useEffect(() => {
    if (!available || !host.current) return
    let disposed = false
    let animation = 0
    let instance: TeacherScene | null = null
    const failure = () => {
      if (disposed) return
      player.current?.reset()
      instance?.dispose()
      scene.current = null
      setReady(false); setActive(false); setConfig(null)
      handlers.current.onError('Не удалось загрузить 3D-преподавателя. Текстовый чат остаётся доступен.')
      handlers.current.onStop()
    }
    void import('./TeacherScene').then(async ({ TeacherScene }) => {
      if (disposed || !host.current) return
      instance = new TeacherScene(host.current, failure)
      scene.current = instance
      await instance.load(config!.model_url!)
      if (disposed) return
      setReady(true)
      const tick = () => {
        if (disposed || !scene.current) return
        const state = player.current!.tick()
        instance!.setFace(state.weights)
        if (state.active !== activeRef.current) { activeRef.current = state.active; setActive(state.active) }
        animation = requestAnimationFrame(tick)
      }
      animation = requestAnimationFrame(tick)
    }).catch(failure)
    return () => {
      disposed = true
      cancelAnimationFrame(animation)
      player.current?.reset()
      instance?.dispose()
      scene.current = null
    }
  }, [available, config?.model_url])

  useEffect(() => () => {
    player.current?.reset()
    void context.current?.close()
    context.current = null
  }, [])

  const stop = () => {
    player.current?.reset(); scene.current?.reset()
    activeRef.current = false; setActive(false)
  }
  return {
    available, ready, active,
    unlock: () => {
      context.current ??= new AudioContext()
      void context.current.resume().catch(() => handlers.current.onError('Разрешите воспроизведение звука в браузере.'))
    },
    prepareResponse: (_question: string) => {},
    behavior: (_state: 'idle' | 'listening' | 'thinking') => {},
    accept: (packet: AvatarPacket) => {
      try {
        if (packet.kind === 'start' && packet.engine !== 'nvidia-audio2face-sdk-mark-2.3') throw new Error('Unexpected animation engine')
        if (packet.names) {
          const supported = new Set(scene.current?.inspect().morphNames.map(normalize))
          if (packet.names.length !== 52 || packet.names.some(name => !supported.has(normalize(name)))) throw new Error('Mismatched facial rig')
        }
        player.current!.accept(packet)
      } catch {
        stop(); handlers.current.onStop()
        handlers.current.onError('Поток 3D-преподавателя прервался. Повторите запрос.')
      }
    },
    stop,
    portrait: available ? <div className="tutor-avatar">
      <div ref={host} style={{ width: '100%', height: '100%' }}/>
      <span className="tutor-avatar-name">Преподаватель</span>
      {active && <button className="icon-button tutor-avatar-stop" type="button" title="Остановить озвучку" aria-label="Остановить озвучку" onClick={() => { stop(); handlers.current.onStop() }}><Square size={14}/></button>}
      {!ready && <span className="tutor-avatar-loading" role="status">Загрузка преподавателя...</span>}
    </div> : null,
  }
}
