import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { api, type LearningItem } from '../api'
import { Button, ErrorState, Input, Loading, Notice, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import type { PracticeVersion } from './types'
import './practice.css'

type DraftState = { draft: PracticeVersion | null; published: PracticeVersion | null; versions: PracticeVersion[] }

export function PracticeEditorPage({ item, moduleTitle }: { item: LearningItem; moduleTitle?: string }) {
  const state = useQuery({ queryKey: ['practice-draft', item.short_id], queryFn: () => api<DraftState>(`items/${item.short_id}/practice/draft/`) })
  if (state.isLoading) return <Loading/>
  if (state.error) return <ErrorState error={state.error}/>
  return <PracticeForm key={item.short_id} item={item} moduleTitle={moduleTitle} initial={state.data!}/>
}

function PracticeForm({ item, moduleTitle, initial }: { item: LearningItem; moduleTitle?: string; initial: DraftState }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const seed = initial.draft ?? initial.published
  const [title, setTitle] = useState(seed?.title ?? item.title)
  const [description, setDescription] = useState(seed?.description ?? item.description)
  const [published, setPublished] = useState(initial.published)
  const [hasDraft, setHasDraft] = useState(Boolean(initial.draft))
  const [dirty, setDirty] = useState(!seed || seed.practice_type !== 'lecture_workshop' || Object.keys(seed.config).length > 0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  useLeaveWarning(dirty)
  const save = async (publish: boolean) => {
    if (busy || !title.trim()) return
    setBusy(true); setMessage('')
    try {
      const path = `items/${item.short_id}/practice/draft/`
      await api<PracticeVersion>(path, 'PUT', { practice_type: 'lecture_workshop', plugin_version: '1.0.0', title: title.trim(), description, config: {} })
      if (publish) setPublished(await api<PracticeVersion>(path, 'POST'))
      setHasDraft(!publish); setDirty(false); setFailed(false)
      setMessage(t(publish ? 'Практика опубликована' : 'Черновик сохранён'))
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'items'] }), qc.invalidateQueries({ queryKey: ['admin-item', item.short_id] }), qc.invalidateQueries({ queryKey: ['practice-draft', item.short_id] })])
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : t('Не удалось сохранить')) }
    finally { setBusy(false) }
  }
  return <div className="practice-editor-page">
    <Link className="back" to="/admin/curriculum"><ArrowLeft size={16}/>{moduleTitle || t('Структура курса')}</Link>
    <span className="eyebrow">{t('ПРАКТИЧЕСКАЯ РАБОТА')}</span><h1>{title || t('Новая практика')}</h1>
    <div className="card form-card">
      <div className="row"><Sparkles size={22}/><h2>{t('Виртуальная мастерская генерации лекции')}</h2></div>
      <p>{t('Студент пишет запрос в чате, получает лекцию и отмечает практику кнопкой «Сделано».')}</p>
      <label>{t('Название')}<Input value={title} maxLength={200} disabled={busy} onChange={event => { setTitle(event.target.value); setDirty(true) }}/></label>
      <label>{t('Описание')}<Textarea value={description} rows={5} disabled={busy} onChange={event => { setDescription(event.target.value); setDirty(true) }}/></label>
      <div className="row"><Button variant="secondary" disabled={busy || !dirty || !title.trim()} onClick={() => void save(false)}>{t('Сохранить')}</Button>
        <Button disabled={busy || !title.trim() || (!dirty && !hasDraft)} onClick={() => void save(true)}>{t(published ? 'Обновить публикацию' : 'Опубликовать')}</Button></div>
    </div>
    <Notice text={message} kind={failed ? 'error' : 'success'}/>
  </div>
}
