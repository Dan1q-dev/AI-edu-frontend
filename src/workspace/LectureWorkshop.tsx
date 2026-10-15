import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, RefreshCw, Send, Sparkles } from 'lucide-react'
import { ApiError } from '../api'
import { Button, ErrorState, Loading, Notice, Textarea } from '../components/ui'
import { RichLessonContent } from '../components/RichLessonContent'
import { useI18n } from '../i18n'
import { useLeaveWarning } from '../useLeaveWarning'
import type { RuntimeProps } from '../practice/types'
import { workspaceApi, readReference, referenceKey, writeReference } from './api'
import { isLecture, type Lecture, type OperationInput, type WorkspaceDocument } from './types'
import './workspace.css'

const failureLabels: Record<string, string> = {
  ai_not_configured: 'AI API не настроен. Обратитесь к администратору.',
  ai_timeout: 'AI не успел ответить. Попробуйте ещё раз.',
  ai_rate_limited: 'Лимит AI-запросов достигнут. Попробуйте позже.',
  revision_conflict: 'Лекция изменилась. Обновите чат и повторите запрос.',
  access_revoked: 'Доступ к работе закрыт.', submission_closed: 'Практическая работа завершена',
}
function requestError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Лекция изменилась или уже выполняется AI-запрос. Обновите чат.'
    if (error.status === 403 || error.status === 404) return 'Доступ к работе закрыт.'
    if (error.status === 503) return 'AI API не настроен. Обратитесь к администратору.'
  }
  return 'Не удалось выполнить запрос. Проверьте соединение и повторите.'
}

function LectureAnswer({ lecture }: { lecture: Lecture }) {
  return <article className="workspace-lecture-answer"><h2>{lecture.title}</h2>{lecture.sections.map(section =>
    <section key={section.id}><h3>{section.title}</h3><RichLessonContent value={JSON.stringify(section.content)}/></section>)}</article>
}

export function LectureWorkshop(props: RuntimeProps) {
  return <LectureChat key={props.state.submission?.status === 'SUBMITTED' ? props.state.submission.id : 'active'} {...props}/>
}

function LectureChat({ state, item, ownerId, busy, onSubmit, onStart }: RuntimeProps) {
  const { t, locale } = useI18n()
  const qc = useQueryClient()
  const reference = readReference(referenceKey(ownerId, state.submission?.id))
  const savedId = state.submission?.document_id ?? state.submission?.submission_data.document_id
  const [documentId, setDocumentId] = useState<number | undefined>(typeof savedId === 'number' ? savedId : reference.document)
  const [operationId, setOperationId] = useState<number | undefined>(reference.operation)
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [retryRequest, setRetryRequest] = useState<{ document: number; input: OperationInput } | null>(null)
  const sendingRef = useRef(false)
  const handledOperation = useRef<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const active = !state.submission || state.submission.status === 'IN_PROGRESS'
  useLeaveWarning(active && Boolean(prompt.trim()))

  useEffect(() => {
    if (typeof savedId === 'number') setDocumentId(savedId)
  }, [savedId])
  const loaded = useQuery({ queryKey: ['workspace-document', ownerId, documentId], enabled: !!documentId, retry: false,
    queryFn: async () => {
      const result = await workspaceApi.document(documentId!)
      if (state.submission && result.submission !== state.submission.id) throw new Error('Документ не принадлежит этой попытке')
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
  const tracking = !!documentId && (loaded.isPending || loaded.isFetching || !!loaded.error || messages.isPending || messages.isFetching || !!messages.error || !!operationId && (operation.isPending || !!operation.error))
  const disabled = !active || busy || sending || pending || tracking

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
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }) }, [messages.data?.length, pending])

  const send = async (text = prompt) => {
    if (sendingRef.current || disabled || !item || (!retryRequest && !text.trim())) return
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
      request ??= { document: document!.id, input: { request_id: crypto.randomUUID(), revision: document!.revision, kind: 'generate', prompt: text.trim() } }
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
  return <div className="lecture-workshop lecture-chat">
    <header className="lecture-chat-heading"><div><span className="eyebrow">{t('ПРАКТИЧЕСКАЯ РАБОТА')}</span><h1>{state.version!.title}</h1><p>{t('Виртуальная мастерская генерации лекции')}</p></div>
      <Button disabled={disabled || !!retryRequest || state.is_completed} onClick={() => void onSubmit({ completed: true })}><Check size={18}/>{t(state.is_completed ? 'Выполнено' : 'Сделано')}</Button></header>
    <div className="lecture-chat-body">
      {state.version!.description && <p className="lecture-chat-instructions">{state.version!.description}</p>}
      {!active && !state.is_completed && <Button disabled={busy} onClick={() => void onStart()}>{t('Продолжить практику')}</Button>}
      <div className="lecture-chat-messages" role="log" aria-label={t('История сообщений')} aria-live="polite">
        {!messages.data?.length && !fallback?.title && <div className="lecture-chat-welcome"><span className="lecture-chat-avatar"><Sparkles size={22}/></span><h2>{t('Какую лекцию подготовим?')}</h2><p>{t('Напишите тему и пожелания в сообщении. AI сгенерирует текст лекции, а вы сможете уточнить запрос в этом же чате.')}</p></div>}
        {documentId && (loaded.isPending || messages.isPending) && <Loading variant="inline"/>}
        {messages.data?.map(message => <div key={message.id} className={`lecture-chat-message ${message.role}`}><span className="lecture-chat-message-author">{t(message.role === 'user' ? 'Вы' : 'AI Assistant')}</span>
          {message.content ? <LectureAnswer lecture={message.content}/> : <p>{message.text}</p>}</div>)}
        {!hasAnswers && fallback && isLecture(fallback) && <div className="lecture-chat-message assistant"><LectureAnswer lecture={fallback}/></div>}
        {(sending || pending) && <div className="lecture-chat-pending" role="status"><Loader2 size={18} className="workspace-spinner"/>{t('Генерируем лекцию…')}</div>}
        <div ref={endRef}/>
      </div>
      <Notice text={error || failure} kind="error"/>
      {active && failure && lastUserMessage && <Button variant="secondary" disabled={disabled || !!retryRequest} onClick={() => void send(lastUserMessage.text)}><RefreshCw size={16}/>{t('Повторить отправку')}</Button>}
      {(loaded.error || messages.error || operation.error) && <Notice text={t('Не удалось обновить чат. Проверьте соединение и повторите.')} kind="error"/>}
      {(error || loaded.error || messages.error || operation.error) && documentId && <Button variant="secondary" disabled={sending} onClick={() => void refresh()}><RefreshCw size={16}/>{t('Обновить чат')}</Button>}
      {active ? <form className="lecture-chat-composer" onSubmit={event => { event.preventDefault(); void send() }}>
        <Textarea aria-label={t('Ваш запрос')} placeholder={t('Напишите запрос для генерации лекции…')} rows={3} maxLength={8000} value={prompt} disabled={disabled || !!retryRequest}
          onChange={event => setPrompt(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() }
          }}/>
        <div className="lecture-chat-composer-actions"><span>{t('Enter — отправить, Shift + Enter — новая строка')}</span><Button type="submit" disabled={disabled || !retryRequest && !prompt.trim()} aria-label={t(retryRequest ? 'Повторить отправку' : 'Отправить запрос')}><Send size={18}/>{t(retryRequest ? 'Повторить отправку' : 'Отправить')}</Button></div>
      </form> : <p className="lecture-chat-completed"><Check size={18}/>{t('Практическая работа завершена')}</p>}
      <p className="lecture-chat-disclaimer">{t('AI может ошибаться. Проверяйте сгенерированный материал.')}</p>
    </div>
  </div>
}
