import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ListChecks, Puzzle } from 'lucide-react'
import { api, type LearningItem } from '../api'
import { Button, ErrorState, Input, Loading, Notice, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import { getPracticePlugin } from './registry'
import type { PracticeManifest, PracticeVersion } from './types'
import './practice.css'

type DraftState = { draft: PracticeVersion | null; published: PracticeVersion | null; versions: PracticeVersion[] }

export function PracticeEditorPage({ item, moduleTitle }: { item: LearningItem; moduleTitle?: string }) {
  const catalog = useQuery({ queryKey: ['practice-types'], queryFn: () => api<PracticeManifest[]>('practice-types/') })
  const state = useQuery({ queryKey: ['practice-draft', item.short_id], queryFn: () => api<DraftState>(`items/${item.short_id}/practice/draft/`) })
  if (catalog.isLoading || state.isLoading) return <Loading/>
  if (catalog.error || state.error) return <ErrorState error={catalog.error || state.error}/>
  return <PracticeForm key={item.short_id} item={item} moduleTitle={moduleTitle} catalog={catalog.data!} initial={state.data!}/>
}

function PracticeForm({ item, moduleTitle, catalog, initial }: { item: LearningItem; moduleTitle?: string; catalog: PracticeManifest[]; initial: DraftState }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const seed = initial.draft ?? initial.published
  const [selected, setSelected] = useState(seed ? { type: seed.practice_type, version: seed.plugin_version } : null)
  const [title, setTitle] = useState(seed?.title ?? item.title)
  const [description, setDescription] = useState(seed?.description ?? item.description)
  const [config, setConfig] = useState(seed?.config ?? {})
  const [published, setPublished] = useState(initial.published)
  const [hasDraft, setHasDraft] = useState(Boolean(initial.draft))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  useLeaveWarning(dirty)
  const plugin = selected ? getPracticePlugin(selected.type, selected.version) : undefined
  const save = async (publish: boolean) => {
    if (!plugin || !selected) return
    const validation = plugin.validateConfig(config)
    if (validation) { setFailed(true); setMessage(t(validation)); return }
    setBusy(true); setMessage('')
    try {
      const path = `items/${item.short_id}/practice/draft/`
      await api<PracticeVersion>(path, 'PUT', { practice_type: selected.type, plugin_version: selected.version, title: title.trim(), description, config })
      if (publish) setPublished(await api<PracticeVersion>(path, 'POST'))
      setHasDraft(!publish)
      setDirty(false); setFailed(false); setMessage(t(publish ? 'Практика опубликована' : 'Черновик сохранён'))
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'items'] }), qc.invalidateQueries({ queryKey: ['admin-item', item.short_id] }), qc.invalidateQueries({ queryKey: ['practice-draft', item.short_id] })])
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : t('Не удалось сохранить')) }
    finally { setBusy(false) }
  }
  const ConfigEditor = plugin?.ConfigEditor
  return <div className="practice-editor-page">
    <Link className="back" to="/admin/curriculum"><ArrowLeft size={16}/>{moduleTitle || t('Структура курса')}</Link>
    <span className="eyebrow">{t('ПРАКТИЧЕСКАЯ РАБОТА')}</span><h1>{title || t('Новая практика')}</h1>
    {published && <p className="practice-version-note">{t('Опубликованная версия')}: {published.version_number}. {t('Изменения сохраняются в новой версии. Начатые попытки сохраняют прежние условия.')}</p>}
    {!selected ? <><h2>{t('Выберите тип практической работы')}</h2><div className="practice-catalog">
      {catalog.map(manifest => {
        const implementation = getPracticePlugin(manifest.type, manifest.version)
        const enabled = manifest.available && Boolean(implementation)
        const Icon = manifest.icon === 'list-checks' ? ListChecks : Puzzle
        return <button className="practice-catalog-card" key={`${manifest.type}@${manifest.version}`} disabled={!enabled} onClick={() => {
          setSelected({ type: manifest.type, version: manifest.version }); setConfig(implementation!.initialConfig()); setDirty(true)
        }}><Icon size={28}/><strong>{t(manifest.name)}</strong><span>{t(manifest.description)}</span><small>{t(manifest.grading === 'self_assessment' ? 'Самооценка' : manifest.grading)} · {manifest.version}</small>{!enabled && <span>{t('Скоро / недоступно')}</span>}</button>
      })}
    </div></> : !ConfigEditor ? <ErrorState error={new Error(t('Этот тип практики пока недоступен'))}/> : <div className="card form-card">
      <label>{t('Название')}<Input value={title} maxLength={200} disabled={busy} onChange={event => { setTitle(event.target.value); setDirty(true) }}/></label>
      <label>{t('Описание')}<Textarea value={description} rows={5} disabled={busy} onChange={event => { setDescription(event.target.value); setDirty(true) }}/></label>
      <ConfigEditor config={config} disabled={busy} onChange={next => { setConfig(next); setDirty(true) }}/>
      <div className="row"><Button variant="secondary" disabled={busy || !dirty || !title.trim()} onClick={() => void save(false)}>{t('Сохранить')}</Button>
        <Button disabled={busy || !title.trim() || (!dirty && !hasDraft)} onClick={() => void save(true)}>{t(published ? 'Обновить публикацию' : 'Опубликовать')}</Button></div>
    </div>}
    <Notice text={message} kind={failed ? 'error' : 'success'}/>
  </div>
}
