import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { api, apiAll, type Track, type User } from './api'
import { Button, Notice, TrackSelect } from './components/ui'
import { updateSession } from './session'
import { useI18n } from './i18n'
import './program-journey.css'

export function TrackOnboarding() {
  const { t } = useI18n()
  const client = useQueryClient()
  const [selected, setSelected] = useState<number>(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const tracks = useQuery({ queryKey: ['onboarding-tracks'], queryFn: () => apiAll<Track>('tracks/') })
  const save = async () => {
    if (!selected || busy) return
    setBusy(true); setError('')
    try {
      const user = await api<User>('auth/me/', 'PATCH', { learning_track: selected })
      await updateSession(client, user)
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="track-onboarding"><span className="eyebrow">{t('Начало обучения')}</span><h1>{t('Выберите траекторию обучения')}</h1>
    <TrackSelect tracks={tracks.data ?? []} selectedTrackId={selected} onSelect={setSelected} isLoading={tracks.isLoading} error={tracks.error ? t('Не удалось загрузить траектории') : null}/>
    {!tracks.isLoading && !tracks.error && !tracks.data?.length && <p>{t('Траектории пока не опубликованы')}</p>}
    {tracks.error && <Button variant="secondary" onClick={() => void tracks.refetch()}>{t('Повторить')}</Button>}
    <Button disabled={!selected || busy} onClick={() => void save()}>{t(busy ? 'Сохранение…' : 'Начать обучение')}<ArrowRight size={17}/></Button><Notice text={error} onDismiss={() => setError('')} kind="error"/>
  </section>
}
