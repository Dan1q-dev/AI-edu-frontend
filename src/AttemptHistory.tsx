import { useInfiniteQuery } from '@tanstack/react-query'
import { api, type Attempt, type Page } from './api'
import { Button, ErrorState, Loading } from './components/ui'
import { useI18n } from './i18n'

export function AttemptHistory() {
  const { t, locale } = useI18n()
  const history = useInfiniteQuery({ queryKey: ['attempts-all'], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<Attempt>>(`attempts/?page=${pageParam}`),
    getNextPageParam: (lastPage, _pages, lastParam) => lastPage.next ? lastParam + 1 : undefined })
  const rows = history.data?.pages.flatMap(page => page.results) ?? []
  return <section className="profile-test-history"><h2 className="section-title">{t('Результаты тестов')}</h2>{history.isLoading ? <Loading/> : <>
    {history.error && <><ErrorState error={history.error}/><Button variant="secondary" onClick={() => void (history.isFetchNextPageError ? history.fetchNextPage() : history.refetch())}>{t('Повторить')}</Button></>}
    <div className="card">{rows.length ? rows.map(attempt => <div className="history-row profile-history-row" key={attempt.id}><div><strong>{attempt.test_title || t('Тест')}</strong><p>{attempt.course_title}</p><small>{new Date(attempt.completed_at).toLocaleString(locale === 'kz' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU')}</small></div><strong>{attempt.percent}%</strong><span className={attempt.passed ? 'good' : 'bad'}>{t(attempt.passed ? 'Пройдено' : 'Не пройдено')}</span></div>) : !history.error && <p>{t('Попыток пока нет.')}</p>}</div>
    {history.hasNextPage && !history.isFetchNextPageError && <Button variant="secondary" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{t(history.isFetchingNextPage ? 'Загрузка…' : 'Показать ещё')}</Button>}
  </>}</section>
}
