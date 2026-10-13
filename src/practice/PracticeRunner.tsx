import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type LearningItem } from '../api'
import { ErrorState, Loading, Notice } from '../components/ui'
import { useI18n } from '../i18n'
import { getPracticePlugin } from './registry'
import type { PracticeState } from './types'
import './practice.css'

export function PracticeRunner({ item, ownerId, onWorkspaceChange }: { item: LearningItem; ownerId?: number; onWorkspaceChange?: (enabled: boolean) => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const key = ['practice', item.short_id]
  const path = `items/${item.short_id}/practice/`
  const state = useQuery({ queryKey: key, queryFn: () => api<PracticeState>(path) })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState(false)
  const plugin = state.data?.version ? getPracticePlugin(state.data.version.practice_type, state.data.version.plugin_version) : undefined
  useEffect(() => {
    onWorkspaceChange?.(plugin?.layout === 'workspace')
    return () => onWorkspaceChange?.(false)
  }, [plugin, onWorkspaceChange])
  const perform = async (start: boolean, data?: Record<string, unknown>) => {
    setBusy(true); setNotice('')
    try {
      const next = await api<PracticeState>(start ? `${path}start/` : path, 'POST', start ? undefined : { submission_id: state.data!.submission!.id, submission_data: data })
      qc.setQueryData(key, next)
      await Promise.all([qc.invalidateQueries({ queryKey: ['course-progress'] }), qc.invalidateQueries({ queryKey: ['learning-summary'] })])
      setFailed(false); if (!start) setNotice(t('Самопроверка сохранена'))
    } catch (error) { setFailed(true); setNotice(error instanceof Error ? error.message : t('Не удалось сохранить')) }
    finally { setBusy(false) }
  }
  if (state.isLoading) return <Loading/>
  if (state.error) return <ErrorState error={state.error}/>
  if (!state.data?.version) return <div className="card"><p>{t('Критерии практики ещё не настроены.')}</p></div>
  if (!plugin) return <ErrorState error={new Error(t('Этот тип практики пока недоступен'))}/>
  const Runtime = plugin.StudentRuntime
  return <><Runtime state={state.data} busy={busy} item={item} ownerId={ownerId} onStart={() => perform(true)} onSubmit={data => perform(false, data)}/><Notice text={notice} kind={failed ? 'error' : 'success'}/></>
}
