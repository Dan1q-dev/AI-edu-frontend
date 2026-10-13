import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Loader2, RefreshCw, Sparkles, WandSparkles } from 'lucide-react'
import { ApiError } from '../api'
import { Button, ErrorState, Loading, Notice, Textarea } from '../components/ui'
import { RichLessonContent } from '../components/RichLessonContent'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import type { ChecklistConfig, RuntimeProps } from '../practice/types'
import { workspaceApi, readReference, referenceKey, writeReference } from './api'
import { initialParameters, isLecture, normalizedParameters, type Lecture, type OperationInput, type WorkspaceDocument } from './types'
import { ParametersForm } from './ParametersForm'
import { LectureEditor } from './LectureEditor'
import './workspace.css'

const failureLabels: Record<string, string> = {
  ai_timeout: 'AI не успел ответить. Попробуйте ещё раз.', operation_timeout: 'Операция прервана. Попробуйте ещё раз.',
  ai_http_error: 'AI-сервис недоступен. Попробуйте позже.', ai_connection_error: 'Не удалось подключиться к AI-сервису.',
  ai_transport_error: 'Не удалось подключиться к AI-сервису.', worker_error: 'Не удалось выполнить AI-запрос.',
  ai_rate_limited: 'Лимит AI-запросов достигнут. Попробуйте позже.', ai_invalid_response: 'AI вернул некорректный ответ. Попробуйте ещё раз.',
  ai_invalid_content: 'AI вернул некорректный ответ. Попробуйте ещё раз.', ai_incomplete_response: 'AI вернул неполный ответ. Попробуйте ещё раз.',
  ai_response_too_large: 'Ответ AI слишком большой. Уточните запрос.', ai_not_configured: 'AI API не настроен. Обратитесь к администратору.',
  revision_conflict: 'Документ изменился. Загрузите актуальную версию перед новым запросом.',
  access_revoked: 'Доступ к работе закрыт.', submission_closed: 'Попытка уже сдана. Начните новую попытку.',
}
function requestError(error: unknown) {
  if (error instanceof Error && ['Формат лекции не поддерживается', 'Документ не принадлежит этой попытке', 'Операция не принадлежит этому документу'].includes(error.message)) return error.message
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Документ изменился или уже выполняется AI-запрос.'
    if (error.status === 403 || error.status === 404) return 'Доступ к работе закрыт.'
    if (error.status === 503) return 'AI API не настроен. Обратитесь к администратору.'
    if (error.status === 400) return 'Проверьте параметры и содержание лекции.'
  }
  return 'Не удалось выполнить запрос. Проверьте соединение и повторите.'
}

export function LectureWorkshop(props: RuntimeProps) {
  return <WorkspaceSession key={props.state.submission?.id ?? 'new'} {...props}/>
}

function WorkspaceSession({ state, item, ownerId, busy: practiceBusy, onStart, onSubmit }: RuntimeProps) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const active = state.submission?.status === 'IN_PROGRESS'
  const version = state.version!
  const key = referenceKey(ownerId, state.submission?.id)
  const [reference] = useState(() => readReference(key))
  const snapshotId = state.submission?.submission_data.document_id
  const [documentId, setDocumentId] = useState<number | undefined>(typeof snapshotId === 'number' ? snapshotId : reference.document)
  const [operationId, setOperationId] = useState<number | undefined>(reference.operation)
  const [document, setDocument] = useState<WorkspaceDocument | null>(null)
  const [parameters, setParameters] = useState(() => initialParameters(locale === 'kz' ? 'kk' : locale))
  const [content, setContent] = useState<Lecture | null>(null)
  const [prompt, setPrompt] = useState('')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const baseRef = useRef<WorkspaceDocument | null>(null)
  const [action, setAction] = useState<'save' | 'start' | null>(null)
  const actionRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [conflict, setConflict] = useState(false)
  const [showServer, setShowServer] = useState(false)
  const [retryRequest, setRetryRequest] = useState<OperationInput | null>(null)
  const [checks, setChecks] = useState<boolean[]>(() => {
    const saved = state.submission?.submission_data.checks
    return Array.isArray(saved) ? saved as boolean[] : (version.config as ChecklistConfig).criteria.map(() => false)
  })
  const handledOperation = useRef<number | null>(null)
  const promptEdited = useRef(false)
  useLeaveWarning(dirty)

  const documentKey = ['workspace-document', ownerId, documentId]
  const loaded = useQuery({ queryKey: documentKey, enabled: !!documentId, retry: false, refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = await workspaceApi.document(documentId!)
      if (result.submission !== state.submission?.id) throw new Error('Документ не принадлежит этой попытке')
      return result
    } })
  const messagesKey = ['workspace-messages', ownerId, documentId]
  const messages = useQuery({ queryKey: messagesKey, enabled: !!documentId && loaded.isSuccess, retry: false,
    queryFn: () => workspaceApi.messages(documentId!), refetchOnWindowFocus: true })
  const operationKey = ['workspace-operation', ownerId, operationId]
  const operation = useQuery({ queryKey: operationKey, enabled: !!operationId && loaded.isSuccess, retry: false,
    queryFn: async () => {
      const result = await workspaceApi.operation(operationId!)
      if (result.document !== documentId) throw new Error('Операция не принадлежит этому документу')
      return result
    }, refetchInterval: query => ['PENDING', 'RUNNING'].includes(query.state.data?.status ?? '') ? 2000 : false,
    refetchOnWindowFocus: true })
  const pending = operation.data?.status === 'PENDING' || operation.data?.status === 'RUNNING'
  const tracking = !!documentId && (!!loaded.error || messages.isPending || !!messages.error || !!operationId && (operation.isPending || !!operation.error))
  const disabled = !active || !!action || practiceBusy || pending
  const aiDisabled = disabled || !document || dirty || conflict || tracking || !!retryRequest

  const install = (next: WorkspaceDocument) => {
    baseRef.current = next; dirtyRef.current = false
    setDocument(next); setParameters(next.parameters); setContent(isLecture(next.content) ? next.content : null)
    setDirty(false); setConflict(false); setShowServer(false); setDocumentId(next.id)
    writeReference(key, next.id, operationId)
  }
  useEffect(() => {
    if (!loaded.data) return
    if (dirtyRef.current) {
      if (loaded.data.revision !== baseRef.current?.revision) setConflict(true)
      return
    }
    install(loaded.data)
  }, [loaded.data])
  useEffect(() => {
    if (!messages.data?.length) return
    const latest = messages.data.at(-1)!
    if (!operationId || latest.operation > operationId) {
      setOperationId(latest.operation)
      if (documentId) writeReference(key, documentId, latest.operation)
    }
    if (!promptEdited.current) {
      const lastUser = messages.data.filter(row => row.role === 'user').at(-1)
      if (lastUser) setPrompt(lastUser.text)
    }
  }, [messages.data])
  useEffect(() => {
    const result = operation.data
    if (!result || pending || handledOperation.current === result.id) return
    handledOperation.current = result.id
    setRetryRequest(null)
    if (result.status === 'SUCCEEDED' && result.kind === 'improve_prompt' && result.result.improved_prompt) {
      setPrompt(result.result.improved_prompt); promptEdited.current = true
    }
    if (result.status === 'FAILED' && result.error_code === 'revision_conflict') setConflict(true)
    void loaded.refetch()
    void messages.refetch()
  }, [operation.data, pending])

  const markDirty = () => { dirtyRef.current = true; setDirty(true); setNotice(''); setError('') }
  const save = async () => {
    if (actionRef.current || disabled || conflict || !item) return
    const normalized = normalizedParameters(parameters)
    if (!normalized) { setError(t('Заполните все параметры лекции и проверьте ограничения.')); return }
    if (content && (!content.title.trim() || content.sections.some(section => !section.title.trim()))) {
      setError(t('Укажите название лекции и каждого раздела.')); return
    }
    actionRef.current = true; setAction('save'); setError(''); setNotice('')
    try {
      const next = document
        ? await workspaceApi.save(document.id, { revision: document.revision, parameters: normalized, ...(content ? { content } : {}) })
        : await workspaceApi.create(item.short_id, normalized)
      if (next.submission !== state.submission?.id) throw new Error('Документ не принадлежит этой попытке')
      install(next)
      qc.setQueryData(['workspace-document', ownerId, next.id], next)
      setNotice(t(document ? 'Изменения сохранены' : 'Документ открыт. Можно отправить AI-запрос.'))
    } catch (caught) {
      setError(t(requestError(caught)))
      if (caught instanceof ApiError && caught.status === 409) { setConflict(true); void loaded.refetch() }
    } finally { actionRef.current = false; setAction(null) }
  }
  const send = async (request: OperationInput) => {
    if (!document || actionRef.current || disabled) return
    actionRef.current = true; setAction('start'); setError(''); setNotice('')
    try {
      const next = await workspaceApi.start(document.id, request)
      setRetryRequest(null); setOperationId(next.id)
      writeReference(key, document.id, next.id)
      qc.setQueryData(['workspace-operation', ownerId, next.id], next)
      void messages.refetch()
    } catch (caught) {
      setError(t(requestError(caught)))
      // Preserve the exact UUID/payload for uncertain delivery; do not enqueue a new request on retry.
      if (!(caught instanceof ApiError) || caught.status >= 500) setRetryRequest(request)
      if (caught instanceof ApiError && caught.status === 409) { setConflict(true); void loaded.refetch(); void messages.refetch() }
    } finally { actionRef.current = false; setAction(null) }
  }
  const start = (kind: OperationInput['kind']) => {
    if (aiDisabled || !document) return
    if (!prompt.trim() || prompt.trim().length > 8000) { setError(t('Введите запрос длиной до 8000 символов.')); return }
    if (kind === 'generate' && content && !window.confirm(t('Заменить сохранённую лекцию новым результатом генерации?'))) return
    void send({ request_id: crypto.randomUUID(), revision: document.revision, kind, prompt: prompt.trim() })
  }
  const reload = async () => {
    if (dirty && !window.confirm(t('Загрузить версию с сервера и заменить несохранённые изменения?'))) return
    const result = await loaded.refetch()
    if (result.data && !result.error) { install(result.data); setError(''); setNotice('') }
  }
  if (!item) return <ErrorState error={new Error(t('Мастерская недоступна'))}/>
  if (documentId && loaded.isPending) return <Loading label={t('Загрузка лекции…')}/>
  const readDenied = loaded.error instanceof ApiError && [403, 404].includes(loaded.error.status)
  const badContract = loaded.error instanceof Error && ['Формат лекции не поддерживается', 'Документ не принадлежит этой попытке'].includes(loaded.error.message)
  if (loaded.error && (!document || readDenied || badContract)) return <><ErrorState error={new Error(t(requestError(loaded.error)))}/><Button variant="secondary" onClick={() => void loaded.refetch()}>{t('Повторить')}</Button></>
  const criteria = (version.config as ChecklistConfig).criteria
  const failure = operation.data?.status === 'FAILED' ? t(failureLabels[operation.data.error_code] ?? 'Не удалось выполнить AI-запрос.') : ''
  return <div className="lecture-workshop">
    <header className="workspace-heading"><div><span className="eyebrow">{t('ВИРТУАЛЬНАЯ РАБОТА №1')}</span><h1>{version.title}</h1><p>{version.description}</p></div>
      <span className="pill">{t('Версия')} {version.version_number} · {t(active ? 'Работа над лекцией' : state.submission ? 'Попытка сдана' : 'Новая работа')}</span></header>
    {!active && <div className="workspace-attempt-banner"><p>{t(state.submission ? 'Сданная лекция доступна для просмотра. Для изменений начните новую попытку.' : 'Начните практическую работу, чтобы создать лекцию.')}</p>
      <Button disabled={practiceBusy} onClick={() => void onStart()}>{t(state.submission ? 'Новая попытка' : 'Начать практическую работу')}</Button></div>}
    <Notice text={error} kind="error"/><Notice text={notice} kind="success"/>
    {loaded.error && <div><Notice text={t(requestError(loaded.error))} kind="error"/><Button variant="secondary" onClick={() => void loaded.refetch()}>{t('Повторить')}</Button></div>}
    {conflict && <div className="workspace-conflict" role="alert"><strong>{t('Конфликт версий')}</strong><p>{t('Ваши изменения сохранены в редакторе. Загрузите актуальную версию или сравните содержание.')}</p>
      <div className="row"><Button variant="secondary" onClick={() => setShowServer(!showServer)}>{t('Показать версию с сервера')}</Button><Button disabled={!!action} onClick={() => void reload()}>{t('Загрузить версию с сервера')}</Button></div>
      {showServer && loaded.data && isLecture(loaded.data.content) && <article className="workspace-server-copy"><h3>{loaded.data.content.title}</h3>{loaded.data.content.sections.map(row => <section key={row.id}><h4>{row.title}</h4><RichLessonContent value={JSON.stringify(row.content)}/></section>)}</article>}
    </div>}
    <div className="lecture-workspace-panels">
      <aside className="workspace-assistant" aria-label={t('AI Assistant')}>
        <header className="workspace-panel-heading"><div><Sparkles size={20}/><h2>{t('AI Assistant')}</h2></div><span className="workspace-assistant-dot"/></header>
        <form onSubmit={event => { event.preventDefault(); void save() }}>
          <ParametersForm value={parameters} disabled={disabled} onChange={value => { setParameters(value); markDirty() }}/>
          {active && <Button type="submit" variant="secondary" disabled={disabled || conflict || !!document && !dirty}>{t(document ? 'Сохранить изменения' : 'Открыть документ')}</Button>}
        </form>
        <div className="workspace-chat"><h3>{t('История сообщений')}</h3>
          {messages.isPending && documentId ? <Loading variant="inline"/> : messages.error ? <><Notice text={t('Не удалось загрузить сообщения.')} kind="error"/><Button variant="secondary" onClick={() => void messages.refetch()}>{t('Повторить')}</Button></> :
            <div className="workspace-messages" role="log" aria-label={t('История сообщений')}>{messages.data?.length ? messages.data.map(row => <div key={row.id} className={`workspace-message ${row.role}`}><strong>{t(row.role === 'user' ? 'Вы' : 'AI Assistant')}</strong><p>{row.text}</p></div>) : <p className="workspace-chat-empty">{t('Опишите, какой должна быть лекция. AI поможет подготовить первый вариант.')}</p>}</div>}
          <label>{t('Ваш запрос')}<Textarea rows={4} maxLength={8000} disabled={disabled || tracking} value={prompt} onChange={event => { setPrompt(event.target.value); promptEdited.current = true }}/></label>
          <div className="workspace-ai-actions"><Button variant="secondary" disabled={aiDisabled || !prompt.trim()} onClick={() => start('improve_prompt')}><WandSparkles size={16}/>{t('Улучшить запрос')}</Button>
            <Button disabled={aiDisabled || !prompt.trim()} onClick={() => start('generate')}><Sparkles size={16}/>{t('Сгенерировать лекцию')}</Button></div>
          {active && (!document || dirty) && <p className="workspace-help">{t(!document ? 'Сохраните параметры, чтобы открыть документ.' : 'Сохраните изменения перед AI-запросом.')}</p>}
          {pending && <div className="workspace-operation-status" role="status"><Loader2 size={17} className="workspace-spinner"/>{t(operation.data?.status === 'PENDING' ? 'Запрос в очереди' : 'AI выполняет запрос')}<small>{t('Можно вернуться позже: операция продолжится в фоне.')}</small></div>}
          {operation.error && <><Notice text={t('Не удалось получить статус AI-запроса.')} kind="error"/><Button variant="secondary" onClick={() => void operation.refetch()}><RefreshCw size={16}/>{t('Обновить статус')}</Button></>}
          {failure && <Notice text={failure} kind="error"/>}
          {active && (retryRequest || failure) && <Button variant="secondary" disabled={disabled || conflict || tracking || dirty} onClick={() => retryRequest ? void send(retryRequest) : start(operation.data!.kind)}><RefreshCw size={16}/>{t('Повторить операцию')}</Button>}
        </div>
      </aside>
      <LectureEditor content={content} dirty={dirty} disabled={disabled} readOnly={!active} saving={action === 'save'} conflict={conflict}
        onChange={value => { setContent(value); markDirty() }} onSave={() => void save()}/>
    </div>
    {document && <section className="workspace-self-assessment card"><h2>{t('Самопроверка')}</h2><p>{t('Это ваша самооценка. Система не проверяет выполненную работу автоматически.')}</p>
      <div className="practice-checks">{criteria.map((criterion, index) => <label key={index}><input type="checkbox" disabled={disabled} checked={checks[index] ?? false} onChange={event => setChecks(current => current.map((value, at) => at === index ? event.target.checked : value))}/>
        <span>{criterion.title}{criterion.is_required && <small> · {t('Обязательный критерий')}</small>}{criterion.description && <p>{criterion.description}</p>}</span></label>)}</div>
      {state.result && <p className="practice-score">{t('Самооценка')}: Ψ = {state.result.psi_value.toFixed(2)} · {state.progress_percent}%</p>}
      {active && <Button disabled={disabled || !content || dirty || conflict || tracking || !!retryRequest} onClick={() => void onSubmit({ document_id: document.id, document_revision: document.revision, checks })}><BookOpen size={16}/>{t('Завершить практическую работу')}</Button>}
    </section>}
  </div>
}
