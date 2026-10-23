import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronDown, ListChecks, Puzzle, Sparkles } from 'lucide-react'
import { api, type LearningItem } from '../api'
import { Button, ErrorState, Input, Loading, Notice } from '../components/ui'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import { getPracticePlugin } from './registry'
import { hasCommonTask, normalizeTaskConfig } from './commonTask'
import type { PracticeManifest, PracticeVersion } from './types'
import { UnsavedPracticeDialog } from './UnsavedPracticeDialog'
import { workshopFor } from '../workspace/workshops'
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
  const navigate = useNavigate()
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  const seed = initial.draft ?? initial.published
  const [selected, setSelected] = useState(seed ? { type: seed.practice_type, version: seed.plugin_version } : null)
  const [config, setConfig] = useState(seed && hasCommonTask(seed.practice_type) ? normalizeTaskConfig(seed.config) : seed?.config ?? {})
  const [catalogOpen, setCatalogOpen] = useState(!seed)
  const catalogTrigger = useRef<HTMLButtonElement>(null)
  const catalogContainer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!catalogOpen) return
    const dismiss = (event: Event) => {
      if (catalogContainer.current && !event.composedPath().includes(catalogContainer.current)) setCatalogOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setCatalogOpen(false)
      catalogTrigger.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('click', dismiss, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('click', dismiss, true)
      document.removeEventListener('keydown', escape)
    }
  }, [catalogOpen])
  const catalog = useQuery({ queryKey: ['practice-types'], queryFn: () => api<PracticeManifest[]>('practice-types/') })
  useLayoutEffect(() => {
    if (catalogOpen && window.innerWidth <= 600) {
      catalogContainer.current?.querySelector('#practice-type-catalog')?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [catalogOpen, catalog.data])
  const [title, setTitle] = useState(seed?.title ?? item.title)
  const description = seed?.description ?? item.description
  const [published, setPublished] = useState(initial.published)
  const [hasDraft, setHasDraft] = useState(Boolean(initial.draft))
  const snapshot = JSON.stringify({ selected, title, config })
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot)
  const dirty = snapshot !== savedSnapshot
  const [saving, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const busy = saving || uploading
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const plugin = selected ? getPracticePlugin(selected.type, selected.version) : undefined
  const manifest = catalog.data?.find(entry => entry.type === selected?.type && entry.version === selected.version)
  const ConfigEditor = plugin?.ConfigEditor
  useLeaveWarning(dirty, setLeaveTo)
  const save = async (publish: boolean) => {
    if (busy || !title.trim() || !selected || !plugin) return false
    const validation = plugin.validateConfig(config)
    if (validation) { setFailed(true); setMessage(t(validation)); return false }
    setBusy(true); setMessage('')
    try {
      const path = `items/${item.short_id}/practice/draft/`
      await api<PracticeVersion>(path, 'PUT', { practice_type: selected.type, plugin_version: selected.version, title: title.trim(), description, config })
      setTitle(title.trim()); setSavedSnapshot(JSON.stringify({ selected, title: title.trim(), config }))
      setHasDraft(true)
      if (publish) { setPublished(await api<PracticeVersion>(path, 'POST')); setHasDraft(false) }
      setFailed(false)
      setMessage(t(publish ? 'Практика опубликована' : 'Черновик сохранён'))
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'items'] }), qc.invalidateQueries({ queryKey: ['admin-item', item.short_id] }), qc.invalidateQueries({ queryKey: ['practice-draft', item.short_id] })])
      return true
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : t('Не удалось сохранить')) }
    finally { setBusy(false) }
  }
  const choose = (entry: PracticeManifest) => {
    const implementation = getPracticePlugin(entry.type, entry.version)
    if (busy || !entry.available || !implementation) return
    const next = implementation.initialConfig()
    if (selected && hasCommonTask(selected.type) && hasCommonTask(entry.type)) {
      for (const field of ['instructions', 'criteria', 'source_url', 'source_files']) if (field in config) next[field] = config[field]
    }
    setSelected({ type: entry.type, version: entry.version }); setConfig(next)
    setCatalogOpen(false); setMessage(''); setFailed(false)
    catalogTrigger.current?.focus()
  }
  const track = params.get('track')
  const selectedName = manifest?.name ?? workshopFor(selected?.type ?? '')?.title ?? 'Выбранная практика'
  const SelectedIcon = manifest?.icon === 'sparkles' ? Sparkles : manifest?.icon === 'list-checks' ? ListChecks : Puzzle
  const alternatives = catalog.data?.filter(entry => entry.available && getPracticePlugin(entry.type, entry.version)
    && (entry.type !== selected?.type || entry.version !== selected.version)) ?? []
  return <div className="practice-editor-page">
    <header className="practice-editor-toolbar">
      <Link className="back" to={`/admin/curriculum${track ? `?track=${encodeURIComponent(track)}` : ''}`} title={moduleTitle || t('Структура курса')}><ArrowLeft size={16}/><span>{moduleTitle || t('Структура курса')}</span></Link>
      <div className="practice-editor-actions">
        <span className="practice-save-status" role="status">{t(busy ? 'Сохранение…' : dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены')}</span>
        <Button variant="secondary" disabled={busy || !dirty || !title.trim() || !plugin} onClick={() => void save(false)}>{t('Сохранить')}</Button>
        <Button disabled={busy || !title.trim() || !plugin || (!dirty && !hasDraft)} onClick={() => void save(true)}>{t(published ? 'Обновить публикацию' : 'Опубликовать')}</Button>
      </div>
    </header>
    <div className="practice-editor-content">
    <span className="eyebrow">{t('ПРАКТИЧЕСКАЯ РАБОТА')}</span><h1>{title || t('Новая практика')}</h1>
    {published && <p className="practice-version-note">{t('Изменения сохраняются в новой версии. Начатые попытки сохраняют прежние условия.')}</p>}
    <div className="card form-card">
      <div className="practice-selector" ref={catalogContainer} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setCatalogOpen(false)
      }}>
      <div className="practice-selection-heading"><span className="practice-selection-icon"><SelectedIcon size={20} aria-hidden="true"/></span><h2>{t(selected ? selectedName : 'Выберите тип практической работы')}</h2><button ref={catalogTrigger} type="button" className="button secondary" disabled={busy} aria-expanded={catalogOpen} aria-controls="practice-type-catalog" onClick={() => setCatalogOpen(open => !open)}>{t(catalogOpen ? 'Закрыть выбор' : selected ? 'Изменить практику' : 'Выбрать практику')}<ChevronDown size={16} aria-hidden="true" className={catalogOpen ? 'is-open' : ''}/></button></div>
      {catalogOpen && <section id="practice-type-catalog" aria-label={t('Выберите тип практической работы')}>
        <p className="practice-catalog-hint">{t('Название, инструкция и критерии сохранятся при смене инструмента.')}</p>
        {catalog.isLoading ? <Loading variant="inline"/> : catalog.error ? <><ErrorState error={catalog.error}/><Button variant="secondary" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>{t('Повторить')}</Button></> : <>
          <div className="practice-catalog">{catalog.data?.map(entry => {
            const active = entry.type === selected?.type && entry.version === selected.version
            const enabled = entry.available && Boolean(getPracticePlugin(entry.type, entry.version))
            const Icon = entry.icon === 'sparkles' ? Sparkles : entry.icon === 'list-checks' ? ListChecks : Puzzle
            return <button type="button" className={`practice-catalog-card${active ? ' is-selected' : ''}`} key={`${entry.type}@${entry.version}`} aria-pressed={active} disabled={busy || !enabled || active} onClick={() => choose(entry)}><span className="practice-catalog-icon"><Icon size={20} aria-hidden="true"/></span><span className="practice-catalog-copy"><strong>{t(entry.name)}</strong><span>{t(entry.description)}</span>{active && <small>{t('Текущая практика')}</small>}{!enabled && <small>{t('Скоро / недоступно')}</small>}</span>{active && <Check size={18} className="practice-catalog-check" aria-hidden="true"/>}</button>
          })}</div>
          {!alternatives.length && <p>{t('Других доступных практик пока нет.')}</p>}
        </>}
      </section>}
      </div>
      {selected && !plugin && <Notice text={t('Этот тип практики пока недоступен')} kind="error"/>}
      <label>{t('Название')}<Input value={title} maxLength={200} disabled={busy} onChange={event => setTitle(event.target.value)}/></label>
      {ConfigEditor && <ConfigEditor key={selected?.type} itemId={item.short_id} config={config} disabled={busy} onUploadingChange={setUploading} onChange={setConfig}/>}
    </div>
    <Notice text={message} onDismiss={() => setMessage('')} kind={failed ? 'error' : 'success'}/>
    </div>
    {leaveTo && <UnsavedPracticeDialog busy={busy} canSave={Boolean(title.trim() && plugin)} error={failed ? message : ''}
      onCancel={() => setLeaveTo(null)} onDiscard={() => navigate(leaveTo)}
      onSave={() => { void save(false).then(saved => { if (saved) navigate(leaveTo) }) }}/>}
  </div>
}
