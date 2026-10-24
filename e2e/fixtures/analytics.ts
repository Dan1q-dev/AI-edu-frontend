import type { LearningAnalytics } from '../../src/admin/analytics'

export const analyticsFixture: LearningAnalytics = {
  generated_at: '2026-10-24T09:30:00Z', period: '30d', since: '2026-09-24T09:30:00Z',
  filters: { track: null, course: null },
  options: {
    tracks: [{ id: 1, title: 'Траектория 1: для IT-специальностей' }, { id: 2, title: 'Траектория 2: для других специальностей' }],
    courses: [
      { id: 1, short_id: 'python', title: 'Искусственный интеллект для IT-специалистов', learning_track_id: 1 },
      { id: 2, short_id: 'prompt', title: 'Промпт-инжиниринг', learning_track_id: 1 },
      { id: 3, short_id: 'intro', title: 'Введение в искусственный интеллект', learning_track_id: 2 },
    ],
  },
  summary: { total_students: 120, started_students: 48, active_students: 21, completed_students: 14,
    course_count: 3, module_count: 2, item_count: 8 },
  tracks: [
    { id: 1, title: 'Траектория 1: для IT-специальностей', assigned_students: 90, started_students: 48, active_students: 21 },
    { id: 2, title: 'Траектория 2: для других специальностей', assigned_students: 30, started_students: 0, active_students: 0 },
  ],
  courses: [
    { id: 1, short_id: 'python', title: 'Искусственный интеллект для IT-специалистов', learning_track_id: 1,
      module_count: 1, item_count: 5, started_students: 40, active_students: 18, completed_students: 12, completion_rate: 30 },
    { id: 2, short_id: 'prompt', title: 'Промпт-инжиниринг', learning_track_id: 1,
      module_count: 1, item_count: 3, started_students: 12, active_students: 6, completed_students: 3, completion_rate: 25 },
    { id: 3, short_id: 'intro', title: 'Введение в искусственный интеллект', learning_track_id: 2,
      module_count: 0, item_count: 0, started_students: 0, active_students: 0, completed_students: 0, completion_rate: 0 },
  ],
  modules: [
    { id: 1, short_id: 'basics', title: 'Основы искусственного интеллекта', course_id: 1,
      item_count: 5, started_students: 40, active_students: 18, completed_students: 12, completion_rate: 30 },
    { id: 2, short_id: 'practice', title: 'Практическое применение', course_id: 2,
      item_count: 3, started_students: 12, active_students: 6, completed_students: 3, completion_rate: 25 },
  ],
}
