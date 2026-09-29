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
    title: 'Искусственный интеллект и Data Science',
    description: 'Основы нейросетей, машинного обучения и аналитики данных',
    cover: null,
    is_published: true,
    is_active: true,
    is_system: true
  },
  {
    id: 2,
    short_id: 'trk2',
    title: 'Веб-разработка и облачные сервисы',
    description: 'Fullstack разработка современных веб-приложений и API',
    cover: null,
    is_published: true,
    is_active: true,
    is_system: false
  },
  {
    id: 3,
    short_id: 'trk3',
    title: 'Информационная безопасность',
    description: 'Защита сетей, криптография и аудит уязвимостей',
    cover: null,
    is_published: true,
    is_active: true,
    is_system: false
  },
  {
    id: 4,
    short_id: 'trk4',
    title: 'Дизайн цифровых продуктов',
    description: 'UX/UI проектирование интерфейсов и дизайн-систем',
    cover: null,
    is_published: true,
    is_active: true,
    is_system: false
  }
]

describe('TrackSelect component', () => {
  afterEach(cleanup)

  it('renders placeholder when no track is selected', () => {
    render(<TrackSelect tracks={mockTracks} onSelect={vi.fn()} />)
    expect(screen.getByText('Выберите траекторию обучения')).toBeTruthy()
    expect(screen.getByText('Определяет стартовую программу курсов')).toBeTruthy()
  })

  it('displays skeleton when isLoading is true', () => {
    render(<TrackSelect tracks={[]} isLoading={true} onSelect={vi.fn()} />)
    expect(screen.getByRole('status', { name: /загрузка списка траекторий/i })).toBeTruthy()
  })

  it('opens popover on click and renders all tracks with descriptions', () => {
    render(<TrackSelect tracks={mockTracks} onSelect={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /траектория обучения/i })

    // Popover is closed initially
    expect(screen.queryByRole('listbox')).toBeNull()

    // Click to open
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeTruthy()

    // Tracks are visible
    expect(screen.getByText('Искусственный интеллект и Data Science')).toBeTruthy()
    expect(screen.getByText('Основы нейросетей, машинного обучения и аналитики данных')).toBeTruthy()
    expect(screen.getByText('Веб-разработка и облачные сервисы')).toBeTruthy()
    expect(screen.getByText('Базовая')).toBeTruthy() // system badge
  })

  it('calls onSelect when clicking a track option and closes menu', () => {
    const handleSelect = vi.fn()
    render(<TrackSelect tracks={mockTracks} onSelect={handleSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /траектория обучения/i }))
    fireEvent.click(screen.getByText('Искусственный интеллект и Data Science'))

    expect(handleSelect).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('renders selected track state with tone badge and eyebrow', () => {
    render(<TrackSelect tracks={mockTracks} selectedTrackId={2} onSelect={vi.fn()} />)

    expect(screen.getByText('ВЫБРАННАЯ ТРАЕКТОРИЯ')).toBeTruthy()
    expect(screen.getByText('Веб-разработка и облачные сервисы')).toBeTruthy()
    expect(screen.getByText('Fullstack разработка современных веб-приложений и API')).toBeTruthy()
    expect(screen.getByText('Сменить')).toBeTruthy()
  })

  it('filters tracks by search query when there are more than 3 tracks', () => {
    render(<TrackSelect tracks={mockTracks} onSelect={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /траектория обучения/i }))
    const searchInput = screen.getByPlaceholderText('Поиск направления…')

    fireEvent.change(searchInput, { target: { value: 'безопасность' } })

    expect(screen.getByText('Информационная безопасность')).toBeTruthy()
    expect(screen.queryByText('Веб-разработка и облачные сервисы')).toBeNull()
  })

  it('closes popover on outside click', () => {
    render(
      <div>
        <div data-testid="outside">Вне компонента</div>
        <TrackSelect tracks={mockTracks} onSelect={vi.fn()} />
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: /траектория обучения/i }))
    expect(screen.getByRole('listbox')).toBeTruthy()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('listbox')).toBeNull()
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
      email: 'newstudent@example.test',
      first_name: 'Анна',
      last_name: 'Смирнова',
      role: 'STUDENT',
      learning_track: { id: 1, short_id: 'trk1', title: 'Искусственный интеллект и Data Science' }
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
    await screen.findByText('Выберите траекторию обучения')

    // Open dropdown and select track 1
    fireEvent.click(screen.getByRole('button', { name: /траектория обучения/i }))
    const trackOption = await screen.findByText('Искусственный интеллект и Data Science')
    fireEvent.click(trackOption)

    // Fill registration form inputs
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'Анна' } })
    fireEvent.change(screen.getByPlaceholderText('Фамилия'), { target: { value: 'Смирнова' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newstudent@example.test' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'StrongPassword123!' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        'auth/register/',
        'POST',
        expect.objectContaining({
          email: 'newstudent@example.test',
          first_name: 'Анна',
          last_name: 'Смирнова',
          learning_track: 1
        })
      )
    })
  })
})
