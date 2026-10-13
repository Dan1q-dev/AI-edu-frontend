import { Input, Select, Textarea } from '../components/ui'
import { useI18n } from '../i18n'
import type { LectureParameters } from './types'

export function ParametersForm({ value, onChange, disabled }: { value: LectureParameters; onChange: (value: LectureParameters) => void; disabled: boolean }) {
  const { t } = useI18n()
  const change = <K extends keyof LectureParameters>(key: K, next: LectureParameters[K]) => onChange({ ...value, [key]: next })
  return <fieldset className="workspace-parameters" disabled={disabled}>
    <legend>{t('Параметры лекции')}</legend>
    <label>{t('Дисциплина')}<Input required maxLength={200} value={value.discipline} onChange={event => change('discipline', event.target.value)}/></label>
    <label>{t('Тема лекции')}<Input required maxLength={300} value={value.topic} onChange={event => change('topic', event.target.value)}/></label>
    <div className="workspace-fields-row"><label>{t('Курс обучения')}<Input required maxLength={100} value={value.course} onChange={event => change('course', event.target.value)}/></label>
      <label>{t('Продолжительность, мин')}<Input required type="number" min={5} max={480} step={1} value={value.duration_minutes || ''} onChange={event => change('duration_minutes', Number(event.target.value))}/></label></div>
    <label>{t('Целевая аудитория')}<Textarea required rows={2} maxLength={500} value={value.audience} onChange={event => change('audience', event.target.value)}/></label>
    <div className="workspace-fields-row"><label>{t('Уровень сложности')}<Select value={value.difficulty} onChange={event => change('difficulty', event.target.value as LectureParameters['difficulty'])}>
      <option value="beginner">{t('Начальный')}</option><option value="intermediate">{t('Средний')}</option><option value="advanced">{t('Продвинутый')}</option></Select></label>
      <label>{t('Язык лекции')}<Select value={value.language} onChange={event => change('language', event.target.value as LectureParameters['language'])}>
        <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></Select></label></div>
    <label>{t('Результаты обучения')}<Textarea aria-label={t('Результаты обучения')} required rows={3} value={value.learning_outcomes.join('\n')} onChange={event => change('learning_outcomes', event.target.value.split('\n'))}/><small>{t('Каждый результат с новой строки. От 1 до 30, до 500 символов каждый.')}</small></label>
  </fieldset>
}
