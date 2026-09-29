import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TrackSelect } from './components/TrackSelect'
import { AuthPage } from './AuthPage'
import { api, apiAll, type Track } from './api'

vi.mock('./api', () => ({
  api: vi.fn(),
  apiAll: vi.fn()
}))

const mockedApi = vi.mocked(api)
const mockedApiAll = vi.mocked(apiAll)

const mockTracks: Track[] = [
  {
    id: 1,
    short_id: 'trk1',
    title: 'Обучающийся',
    description: 'Основная траектория',
    cover: null,
    is_published: true,
    is_active: true,
    is_system: true
  },
  {
    id: 2,
    short_id: 'trk2',
    title: 'Исследователь',
    description: 'Продвинутая исследовательская программа',
    cover: null,
    is_published: true,
    is_active: true,
    is_system: false
  }
]

describe('TrackSelect minimal button component', () => {
  afterEach(cleanup)

  it('renders track toggle buttons side by side', () => {
    render(<TrackSelect tracks={mockTracks} onSelect={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /обучающийся/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /исследователь/i })).toBeTruthy()
  })

  it('displays skeleton when isLoading is true', () => {
    render(<TrackSelect tracks={[]} isLoading={true} onSelect={vi.fn()} />)
    expect(screen.getByRole('status', { name: /загрузка траекторий/i })).toBeTruthy()
  })

  it('calls onSelect when clicking a track button', () => {
    const handleSelect = vi.fn()
    render(<TrackSelect tracks={mockTracks} onSelect={handleSelect} />)

    fireEvent.click(screen.getByRole('radio', { name: /обучающийся/i }))
    expect(handleSelect).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole('radio', { name: /исследователь/i }))
    expect(handleSelect).toHaveBeenCalledWith(2)
  })

  it('marks selected track with active class and aria-checked', () => {
    render(<TrackSelect tracks={mockTracks} selectedTrackId={2} onSelect={vi.fn()} />)

    const btn1 = screen.getByRole('radio', { name: /обучающийся/i })
    const btn2 = screen.getByRole('radio', { name: /исследователь/i })

    expect(btn1.getAttribute('aria-checked')).toBe('false')
    expect(btn1.className).not.toContain('active')

    expect(btn2.getAttribute('aria-checked')).toBe('true')
    expect(btn2.className).toContain('active')
  })
})

describe('Registration flow with TrackSelect', () => {
  beforeEach(() => {
    mockedApi.mockReset()
    mockedApiAll.mockReset()
  })
  afterEach(cleanup)

  it('successfully selects a trajectory and submits registration', async () => {
    mockedApiAll.mockResolvedValue(mockTracks as never)
    mockedApi.mockResolvedValue({
      id: 10,
      email: 'student@example.test',
      first_name: 'Анна',
      last_name: 'Смирнова',
      role: 'STUDENT',
      learning_track: { id: 1, short_id: 'trk1', title: 'Обучающийся' }
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/register']}>
          <AuthPage mode="register" />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Wait for tracks to load
    const studentBtn = await screen.findByRole('radio', { name: /обучающийся/i })

    // Select the first track
    fireEvent.click(studentBtn)

    // Fill registration form inputs
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'Анна' } })
    fireEvent.change(screen.getByPlaceholderText('Фамилия'), { target: { value: 'Смирнова' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.test' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'StrongPassword123!' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        'auth/register/',
        'POST',
        expect.objectContaining({
          email: 'student@example.test',
          first_name: 'Анна',
          last_name: 'Смирнова',
          learning_track: 1
        })
      )
    })
  })
})
