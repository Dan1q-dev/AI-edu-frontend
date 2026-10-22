import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Download, FileText, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react'
import { ApiError } from '../api'
import { Button, ErrorState, Loading, Notice, Select } from '../components/ui'
import { RichLessonContent } from '../components/RichLessonContent'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import type { RuntimeProps } from '../practice/types'
import { workspaceApi, readReference, referenceKey, writeReference } from './api'
import { isWorkspaceContent, type WorkspaceContent, type OperationInput, type WorkspaceDocument, type WorkspaceArtifact } from './types'
import { sessionTypes, workshopFor, type WorkshopDefinition } from './workshops'
import './workspace.css'

const failureLabels: Record<string, string> = {
  ai_not_configured: 'AI API не настроен. Обратитесь к администратору.',
  ai_timeout: 'AI не успел ответить. Попробуйте ещё раз.',
  ai_rate_limited: 'Лимит AI-запросов достигнут. Попробуйте позже.',
  workspace_limit: 'Достигнут часовой лимит: 5 генераций, 10 редактирований или 10 файлов Word. Попробуйте позже.',
  ai_invalid_content: 'Не удалось подготовить материал в допустимом формате до 3000 слов. Попробуйте уточнить запрос.',
  revision_conflict: 'Документ изменился. Обновите чат и повторите запрос.',
  access_revoked: 'Доступ к работе закрыт.', submission_closed: 'Практическая работа завершена',
}
function requestError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Документ изменился или уже выполняется AI-запрос. Обновите чат.'
    if (error.status === 403 || error.status === 404) return 'Доступ к работе закрыт.'
    if (error.status === 503) return 'AI API не настроен. Обратитесь к администратору.'
    if (error.status === 429) return error.message
  }
  return 'Не удалось выполнить запрос. Проверьте соединение и повторите.'
}

function DocumentAnswer({ content }: { content: WorkspaceContent }) {
  return <article className="workspace-lecture-answer"><h2>{content.title}</h2>{content.sections.map(section =>
    <section key={section.id}><h3>{section.title}</h3><RichLessonContent value={JSON.stringify(section.content)}/></section>)}</article>
}

function DocumentAttachment({ artifact }: { artifact: WorkspaceArtifact }) {
  const { t } = useI18n()
  // Attachments are private, authenticated downloads from our own API only.
  if (!/^\/api\/v1\/workspace\/artifacts\/\d+\/download\/$/.test(artifact.url)) return null
  return <a className="lecture-chat-attachment" href={artifact.url} download={artifact.name}>
    <span className="lecture-chat-file-icon"><FileText size={23}/></span>
    <span><strong>{artifact.name}</strong><small>DOCX · {Math.max(1, Math.ceil(artifact.size / 1024))} {t('КБ')}</small></span>
    <Download size={18} aria-label={t('Скачать файл')}/>
  </a>
}

function fitPrompt(input: HTMLTextAreaElement | null) {
  if (!input) return
  const maximum = Number.parseFloat(getComputedStyle(input).maxHeight) || 160
  input.style.height = '0px'
  const contentHeight = input.value ? input.scrollHeight : 32
  input.style.height = `${Math.min(maximum, Math.max(32, contentHeight))}px`
  input.style.overflowY = contentHeight > maximum ? 'auto' : 'hidden'
}

export function WorkshopChat(props: RuntimeProps) {
  const definition = workshopFor(props.state.version?.practice_type ?? '')
  if (!definition) return <ErrorState error={new Error('Мастерская недоступна')}/>
  return <Chat key={`${props.state.version?.id}:${props.state.submission?.status === 'SUBMITTED' ? props.state.submission.id : 'active'}`} {...props} definition={definition}/>
}

function Chat({ state, item, ownerId, busy, onSubmit, onStart, onReview, onBackToTask, onActivityChange, definition }: RuntimeProps & { definition: WorkshopDefinition }) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const reference = readReference(referenceKey(ownerId, state.submission?.id))
  const savedId = state.submission?.document_id ?? state.submission?.submission_data.document_id
  const [documentId, setDocumentId] = useState<number | undefined>(typeof savedId === 'number' ? savedId : reference.document)
  const [operationId, setOperationId] = useState<number | undefined>(reference.operation)
  const [prompt, setPrompt] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [sessionType, setSessionType] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [retryRequest, setRetryRequest] = useState<{ document: number; input: OperationInput } | null>(null)
  const sendingRef = useRef(false)
  const handledOperation = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const active = !state.submission || state.submission.status === 'IN_PROGRESS'
  useLeaveWarning(active && Boolean(prompt.trim()))

  useEffect(() => {
    if (typeof savedId === 'number') setDocumentId(savedId)
  }, [savedId])
  const loaded = useQuery({ queryKey: ['workspace-document', ownerId, documentId], enabled: !!documentId, retry: false,
    queryFn: async () => {
      const result = await workspaceApi.document(documentId!)
      if (state.submission && result.submission !== state.submission.id) throw new Error('Документ не принадлежит этой попытке')
      if (result.document_type !== definition.documentType) throw new Error('Документ не принадлежит этому конструктору')
      return result
    } })
  const messages = useQuery({ queryKey: ['workspace-messages', ownerId, documentId], enabled: !!documentId && loaded.isSuccess, retry: false,
    queryFn: () => workspaceApi.messages(documentId!) })
  const operation = useQuery({ queryKey: ['workspace-operation', ownerId, operationId], enabled: !!operationId && loaded.isSuccess, retry: false,
    queryFn: async () => {
      const result = await workspaceApi.operation(operationId!)
      if (result.document !== documentId) throw new Error('Операция не принадлежит этому документу')
      return result
    }, refetchInterval: query => ['PENDING', 'RUNNING'].includes(query.state.data?.status ?? '') ? 2000 : false })
  const pending = operation.data?.status === 'PENDING' || operation.data?.status === 'RUNNING'
  const choosing = !messages.data?.length && !loaded.data?.content.title
  const sources = useQuery({ queryKey: ['workspace-source-lectures', ownerId], enabled: !!definition.sourceLecture && active && choosing,
    queryFn: workspaceApi.sourceLectures, retry: false })
  const tracking = !!documentId && (loaded.isPending || loaded.isFetching || !!loaded.error || messages.isPending || messages.isFetching || !!messages.error || !!operationId && (operation.isPending || !!operation.error))
  const disabled = !active || busy || sending || pending || tracking
  useEffect(() => {
    onActivityChange?.(sending || pending || tracking)
    return () => onActivityChange?.(false)
  }, [sending, pending, tracking, onActivityChange])

  useEffect(() => {
    const latest = messages.data?.at(-1)
    if (latest && (!operationId || latest.operation > operationId)) setOperationId(latest.operation)
  }, [messages.data, operationId])
  useEffect(() => {
    const result = operation.data
    if (result && retryRequest?.input.request_id === result.request_id) {
      setRetryRequest(null); setPrompt('')
    }
    if (!result || pending || handledOperation.current === result.id) return
    handledOperation.current = result.id
    void loaded.refetch()
    void messages.refetch()
  }, [operation.data, pending, retryRequest])
  useLayoutEffect(() => fitPrompt(promptRef.current), [prompt, active])
  useEffect(() => {
    const input = promptRef.current
    if (!input || typeof ResizeObserver === 'undefined') return
    let previousWidth = input.clientWidth
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === previousWidth) return
      previousWidth = input.clientWidth
      fitPrompt(input)
    })
    observer.observe(input)
    const resize = () => fitPrompt(input)
    window.addEventListener('resize', resize)
    return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
  }, [active])
  useEffect(() => {
    const scroll = scrollRef.current
    if (scroll) scroll.scrollTop = scroll.scrollHeight
  }, [messages.data, loaded.data?.content, pending])

  const send = async (text = prompt) => {
    const requestText = [choosing && sessionType ? `${t('Формат занятия')}: ${t(sessionType)}.` : '',
      text.trim() || (choosing && sourceId ? t('Подготовь практическое занятие по выбранной лекции.') : '')].filter(Boolean).join('\n')
    if (sendingRef.current || disabled || !item || (!retryRequest && !requestText.trim())) return
    sendingRef.current = true; setSending(true); setError('')
    let request = retryRequest
    try {
      let document: WorkspaceDocument | undefined = loaded.data
      if (!request && !document) {
        document = await workspaceApi.create(item.short_id, locale === 'kz' ? 'kk' : locale)
        setDocumentId(document.id)
        qc.setQueryData(['workspace-document', ownerId, document.id], document)
        writeReference(referenceKey(ownerId, document.submission), document.id)
        await qc.invalidateQueries({ queryKey: ['practice', item.short_id] })
      }
      request ??= { document: document!.id, input: { request_id: crypto.randomUUID(), revision: document!.revision, kind: 'chat', prompt: requestText,
        ...(choosing && sourceId ? { source_lecture_id: Number(sourceId) } : {}) } }
      const next = await workspaceApi.start(request.document, request.input)
      setOperationId(next.id); setRetryRequest(null); setPrompt('')
      writeReference(referenceKey(ownerId, document?.submission ?? state.submission?.id), request.document, next.id)
      qc.setQueryData(['workspace-operation', ownerId, next.id], next)
      await qc.invalidateQueries({ queryKey: ['workspace-messages', ownerId, request.document] })
    } catch (caught) {
      setError(t(requestError(caught)))
      // An uncertain response must retry the same request, including its UUID.
      if (request && (!(caught instanceof ApiError) || caught.status >= 500 && caught.status !== 503)) setRetryRequest(request)
      if (caught instanceof ApiError && caught.status === 409) { void loaded.refetch(); void messages.refetch() }
    } finally { sendingRef.current = false; setSending(false) }
  }
  const refresh = async () => {
    setError('')
    await Promise.all([loaded.refetch(), messages.refetch(), ...(operationId ? [operation.refetch()] : [])])
  }
  if (!item) return <ErrorState error={new Error(t('Мастерская недоступна'))}/>
  if (loaded.error instanceof ApiError && [403, 404].includes(loaded.error.status)) return <ErrorState error={new Error(t('Доступ к работе закрыт.'))}/>
  const failure = operation.data?.status === 'FAILED' ? t(failureLabels[operation.data.error_code] ?? 'Не удалось выполнить AI-запрос. Попробуйте ещё раз.') : ''
  const lastUserMessage = messages.data?.filter(message => message.role === 'user').at(-1)
  const fallback = loaded.data?.content
  const hasAnswers = messages.data?.some(message => message.content)
  const latestAssistant = messages.data?.filter(message => message.role === 'assistant').at(-1)
  const readyForReview = !!loaded.data && isWorkspaceContent(loaded.data.content, definition.documentType) && !busy && !sending && !pending && !tracking
  const goToReview = () => {
    if (!readyForReview || !loaded.data) return
    const document = loaded.data
    const data = { completed: true, document_id: document.id, document_revision: document.revision }
    const file = messages.data?.map(message => message.artifact).filter(artifact => artifact?.revision === document.revision).at(-1)
    if (onReview) onReview(data, { title: document.content.title, files: file ? [{ name: file.name, url: file.url }] : [] })
    else void onSubmit(data)
  }
  return <div className="lecture-workshop lecture-chat">
    <header className="lecture-chat-heading">{onBackToTask && <Button variant="secondary" className="lecture-chat-back" aria-label={t('К заданию')} title={t('К заданию')} onClick={onBackToTask}><ArrowLeft size={16}/></Button>}
      <span className="lecture-chat-heading-icon" aria-hidden="true"><Sparkles size={19}/></span><div><span className="eyebrow">{t(definition.title)}</span><h1 title={state.version!.title}>{state.version!.title}</h1></div>
      <Button disabled={!readyForReview || !!retryRequest} onClick={goToReview} aria-label={t('Перейти к самопроверке')} title={t('Перейти к самопроверке')}>{t('Самопроверка')}<ArrowRight size={15}/></Button></header>
    <div className="lecture-chat-body">
      <div className="lecture-chat-scroll" ref={scrollRef}>
        {!active && !state.is_completed && <Button disabled={busy} onClick={() => void onStart()}>{t('Продолжить практику')}</Button>}
        <div className="lecture-chat-messages" role="log" aria-label={t('История сообщений')} aria-live="polite">
          {choosing && <div className="lecture-chat-welcome"><span className="lecture-chat-avatar"><Sparkles size={22}/></span><h2>{t(definition.welcome)}</h2><p>{t(definition.description)}</p><small className="lecture-chat-scope">{t(definition.scope)}</small>
            {active && definition.sourceLecture && <div className="workshop-source">
              <label>{t('Созданная лекция')}<Select aria-label={t('Созданная лекция')} value={sourceId} disabled={disabled || !!retryRequest || sources.isPending} onChange={event => setSourceId(event.target.value)}>
                <option value="">{t('Своя тема без лекции')}</option>{sources.data?.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}
              </Select></label>
              {sources.isPending && <Loading variant="inline"/>}
              {sources.error ? <><Notice text={t('Не удалось загрузить лекции. Можно написать тему или повторить загрузку.')} kind="error"/><Button variant="secondary" disabled={sources.isFetching} onClick={() => void sources.refetch()}>{t('Повторить')}</Button></> : sources.isSuccess && !sources.data.length && <small>{t('Созданных лекций пока нет. Напишите тему в чате.')}</small>}
            </div>}
            {active && definition.sessionTypes && <div className="lecture-chat-choices workshop-formats" role="group" aria-label={t('Формат занятия')}>
              {sessionTypes.map(type => <button key={type} type="button" aria-pressed={type === sessionType} disabled={disabled || !!retryRequest} onClick={() => setSessionType(type === sessionType ? '' : type)}>{t(type)}</button>)}
            </div>}
          </div>}
          {documentId && (loaded.isPending || messages.isPending) && <Loading variant="inline"/>}
          {messages.data?.map(message => <div key={message.id} className={`lecture-chat-message ${message.role}`}><span className="lecture-chat-message-author">{t(message.role === 'user' ? 'Вы' : 'AI Assistant')}</span>
            {message.content ? <DocumentAnswer content={message.content}/> : <p>{message.text}</p>}
            {message.content && (message.artifact || !!message.choices?.length) && <p>{message.text}</p>}
            {message.artifact && <DocumentAttachment artifact={message.artifact}/>}
            {active && message.id === latestAssistant?.id && !!message.choices?.length && <div className="lecture-chat-choices" role="group" aria-label={t('Варианты ответа')}>
              {message.choices.map(choice => <button key={choice} type="button" disabled={disabled || !!retryRequest || !!prompt.trim()} onClick={() => void send(choice)}>{choice}</button>)}
            </div>}
          </div>)}
          {!hasAnswers && fallback && isWorkspaceContent(fallback, definition.documentType) && <div className="lecture-chat-message assistant"><DocumentAnswer content={fallback}/></div>}
          {(sending || pending) && <div className="lecture-chat-pending" role="status"><Loader2 size={18} className="workspace-spinner"/>{t(sending ? 'Отправляем запрос…' : operation.data?.status === 'PENDING' ? 'Запрос в очереди. Ожидаем начала генерации…' : 'Помощник готовит ответ…')}</div>}
        </div>
        <Notice text={error || failure} kind="error"/>
        {active && failure && lastUserMessage && <Button variant="secondary" disabled={disabled || !!retryRequest} onClick={() => void send(lastUserMessage.text)}><RefreshCw size={16}/>{t('Повторить отправку')}</Button>}
        {(loaded.error || messages.error || operation.error) && <Notice text={t('Не удалось обновить чат. Проверьте соединение и повторите.')} kind="error"/>}
        {(error || loaded.error || messages.error || operation.error) && documentId && <Button variant="secondary" disabled={sending} onClick={() => void refresh()}><RefreshCw size={16}/>{t('Обновить чат')}</Button>}
      </div>
      <div className="lecture-chat-footer">
        {active ? <form className="lecture-chat-composer" onSubmit={event => { event.preventDefault(); void send() }}>
          <textarea ref={promptRef} className="input" aria-label={t('Ваш запрос')} placeholder={t('Напишите сообщение…')} rows={1} maxLength={8000} value={prompt} disabled={disabled || !!retryRequest}
            onChange={event => setPrompt(event.target.value)} onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() }
            }}/>
          <Button type="submit" className="lecture-chat-send" disabled={disabled || !retryRequest && !prompt.trim() && !(choosing && sourceId)} title={t(retryRequest ? 'Повторить отправку' : 'Отправить запрос')} aria-label={t(retryRequest ? 'Повторить отправку' : 'Отправить запрос')}><Send size={16}/></Button>
        </form> : <p className="lecture-chat-completed"><Check size={18}/>{t('Практическая работа завершена')}</p>}
        <p className="lecture-chat-disclaimer">{t('AI может ошибаться. Проверяйте сгенерированный материал.')}</p>
      </div>
    </div>
  </div>
}
