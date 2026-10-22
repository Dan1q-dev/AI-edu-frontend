import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ListChecks, Puzzle, Sparkles } from 'lucide-react'
import { api, type LearningItem } from '../api'
import { Button, ErrorState, Input, Loading, Notice, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import { getPracticePlugin } from './registry'
import { hasCommonTask, normalizeTaskConfig } from './commonTask'
import type { PracticeManifest, PracticeVersion } from './types'
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
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const seed = initial.draft ?? initial.published
  const [selected, setSelected] = useState(seed ? { type: seed.practice_type, version: seed.plugin_version } : null)
  const [config, setConfig] = useState(seed && hasCommonTask(seed.practice_type) ? normalizeTaskConfig(seed.config) : seed?.config ?? {})
  const [catalogOpen, setCatalogOpen] = useState(!seed)
  const catalogTrigger = useRef<HTMLButtonElement>(null)
  const catalog = useQuery({ queryKey: ['practice-types'], queryFn: () => api<PracticeManifest[]>('practice-types/') })
  const [title, setTitle] = useState(seed?.title ?? item.title)
  const [description, setDescription] = useState(seed?.description ?? item.description)
  const [published, setPublished] = useState(initial.published)
  const [hasDraft, setHasDraft] = useState(Boolean(initial.draft))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const plugin = selected ? getPracticePlugin(selected.type, selected.version) : undefined
  const manifest = catalog.data?.find(entry => entry.type === selected?.type && entry.version === selected.version)
  const ConfigEditor = plugin?.ConfigEditor
  useLeaveWarning(dirty)
  const save = async (publish: boolean) => {
    if (busy || !title.trim() || !selected || !plugin) return
    const validation = plugin.validateConfig(config)
    if (validation) { setFailed(true); setMessage(t(validation)); return }
    setBusy(true); setMessage('')
    try {
      const path = `items/${item.short_id}/practice/draft/`
      await api<PracticeVersion>(path, 'PUT', { practice_type: selected.type, plugin_version: selected.version, title: title.trim(), description, config })
      setHasDraft(true)
      if (publish) { setPublished(await api<PracticeVersion>(path, 'POST')); setHasDraft(false) }
      setDirty(false); setFailed(false)
      setMessage(t(publish ? 'Практика опубликована' : 'Черновик сохранён'))
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'items'] }), qc.invalidateQueries({ queryKey: ['admin-item', item.short_id] }), qc.invalidateQueries({ queryKey: ['practice-draft', item.short_id] })])
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : t('Не удалось сохранить')) }
    finally { setBusy(false) }
  }
  const choose = (entry: PracticeManifest) => {
    const implementation = getPracticePlugin(entry.type, entry.version)
    if (busy || !entry.available || !implementation) return
    const next = implementation.initialConfig()
    if (selected && hasCommonTask(selected.type) && hasCommonTask(entry.type)) {
      for (const field of ['instructions', 'criteria', 'source_url']) if (field in config) next[field] = config[field]
    }
    setSelected({ type: entry.type, version: entry.version }); setConfig(next)
    setDirty(true); setCatalogOpen(false); setMessage(''); setFailed(false)
    catalogTrigger.current?.focus()
  }
  const track = params.get('track')
  const selectedName = manifest?.name ?? (selected?.type === 'lecture_workshop' ? 'Виртуальная мастерская генерации лекции' : 'Выбранная практика')
  const alternatives = catalog.data?.filter(entry => entry.available && getPracticePlugin(entry.type, entry.version)
    && (entry.type !== selected?.type || entry.version !== selected.version)) ?? []
  return <div className="practice-editor-page">
    <Link className="back" to={`/admin/curriculum${track ? `?track=${encodeURIComponent(track)}` : ''}`}><ArrowLeft size={16}/>{moduleTitle || t('Структура курса')}</Link>
    <span className="eyebrow">{t('ПРАКТИЧЕСКАЯ РАБОТА')}</span><h1>{title || t('Новая практика')}</h1>
    {published && <p className="practice-version-note">{t('Изменения сохраняются в новой версии. Начатые попытки сохраняют прежние условия.')}</p>}
    <div className="card form-card">
      <div className="practice-selection-heading"><h2>{t(selected ? selectedName : 'Выберите тип практической работы')}</h2><button ref={catalogTrigger} type="button" className="button secondary" disabled={busy} aria-expanded={catalogOpen} aria-controls="practice-type-catalog" onClick={() => setCatalogOpen(open => !open)}>{t(catalogOpen ? 'Закрыть выбор' : selected ? 'Изменить практику' : 'Выбрать практику')}</button></div>
      {manifest && <p>{t(manifest.description)}</p>}
      {catalogOpen && <section id="practice-type-catalog" aria-label={t('Выберите тип практической работы')}>
        <p>{t('Название, описание, инструкция и критерии сохранятся при смене инструмента.')}</p>
        {catalog.isLoading ? <Loading variant="inline"/> : catalog.error ? <><ErrorState error={catalog.error}/><Button variant="secondary" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>{t('Повторить')}</Button></> : <>
          <div className="practice-catalog">{catalog.data?.map(entry => {
            const active = entry.type === selected?.type && entry.version === selected.version
            const enabled = entry.available && Boolean(getPracticePlugin(entry.type, entry.version))
            const Icon = entry.icon === 'sparkles' ? Sparkles : entry.icon === 'list-checks' ? ListChecks : Puzzle
            return <button type="button" className={`practice-catalog-card${active ? ' is-selected' : ''}`} key={`${entry.type}@${entry.version}`} aria-pressed={active} disabled={busy || !enabled || active} onClick={() => choose(entry)}><Icon size={24} aria-hidden="true"/><strong>{t(entry.name)}</strong><span>{t(entry.description)}</span>{active && <small>{t('Текущая практика')}</small>}{!enabled && <small>{t('Скоро / недоступно')}</small>}</button>
          })}</div>
          {!alternatives.length && <p>{t('Других доступных практик пока нет.')}</p>}
        </>}
      </section>}
      {selected && !plugin && <Notice text={t('Этот тип практики пока недоступен')} kind="error"/>}
      <label>{t('Название')}<Input value={title} maxLength={200} disabled={busy} onChange={event => { setTitle(event.target.value); setDirty(true) }}/></label>
      <label>{t('Описание')}<Textarea value={description} rows={5} disabled={busy} onChange={event => { setDescription(event.target.value); setDirty(true) }}/></label>
      {ConfigEditor && <ConfigEditor key={selected?.type} config={config} disabled={busy} onChange={value => { setConfig(value); setDirty(true) }}/>}
      <div className="row"><Button variant="secondary" disabled={busy || !dirty || !title.trim() || !plugin} onClick={() => void save(false)}>{t('Сохранить')}</Button>
        <Button disabled={busy || !title.trim() || !plugin || (!dirty && !hasDraft)} onClick={() => void save(true)}>{t(published ? 'Обновить публикацию' : 'Опубликовать')}</Button></div>
    </div>
    <Notice text={message} kind={failed ? 'error' : 'success'}/>
  </div>
}
