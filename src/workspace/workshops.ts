export type WorkshopDefinition = {
  documentType: string
  title: string
  welcome: string
  description: string
  scope: string
  sourceLecture?: boolean
  sessionTypes?: boolean
}

export const workshops: Record<string, WorkshopDefinition> = {
  lecture_workshop: {
    documentType: 'lecture', title: 'Мастерская лекций', welcome: 'Какую лекцию подготовим?',
    description: 'Напишите тему. Помощник уточнит аудиторию, длительность и язык, подготовит полную лекцию и поможет оформить её в Word.',
    scope: 'Полные лекции · Редактирование · Word (.docx)',
  },
  practical_workshop: {
    documentType: 'practical_session', title: 'Конструктор практического занятия', welcome: 'Какое практическое занятие подготовим?',
    description: 'Напишите тему или вставьте текст лекции. Помощник подготовит цель, задачи, задания трёх уровней сложности, кейсы, проблемные вопросы, этапы, критерии оценки и ожидаемые результаты.',
    scope: 'Базовый · Средний · Продвинутый · Word (.docx)', sourceLecture: true,
  },
  pedagogical_workshop: {
    documentType: 'pedagogical_scenario', title: 'Виртуальный педагогический конструктор', welcome: 'Выберите формат занятия',
    description: 'Выберите тип занятия и напишите тему. Помощник уточнит аудиторию и длительность, затем создаст полный сценарий с этапами, ролями, заданиями и оцениванием.',
    scope: '8 форматов занятия · Полный сценарий · Word (.docx)', sessionTypes: true,
  },
  syllabus_workshop: {
    documentType: 'syllabus', title: 'Виртуальный конструктор силлабуса', welcome: 'Для какой дисциплины создадим силлабус?',
    description: 'Укажите название дисциплины, специальность, количество кредитов, продолжительность в неделях и результаты обучения. Помощник подготовит тематический план, лекции, практические и самостоятельные задания, методы обучения, оценивание и литературу.',
    scope: 'План дисциплины · Результаты обучения · Word (.docx)',
  },
}

export const sessionTypes = [
  'Семинар', 'Круглый стол', 'Дискуссия', 'Деловая игра', 'Кейс',
  'Исследовательское занятие', 'Проектная работа', 'Групповое занятие',
] as const

export function workshopFor(practiceType: string): WorkshopDefinition | undefined {
  const type = practiceType === 'checklist_practice' ? 'lecture_workshop' : practiceType
  return Object.hasOwn(workshops, type) ? workshops[type] : undefined
}
