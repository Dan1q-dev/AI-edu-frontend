import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from './MainLayout'
import type { User } from '../api'

const mockUser: User = {
  id: 1,
  email: 'test@example.com',
  first_name: 'Алексей',
  last_name: 'Иванов',
  role: 'STUDENT',
  learning_track: null,
}

function renderLayout(user: User = mockUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MainLayout user={user}>
          <div data-testid="page-content">Контент страницы</div>
        </MainLayout>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('does not render the hamburger navigation button', () => {
    renderLayout()
    expect(screen.queryByLabelText(/навигацию/i)).toBeNull()
    expect(document.querySelector('.main-nav-toggle')).toBeNull()
  })

  it('renders user details dropdown and closes when clicking outside', () => {
    renderLayout()
    const details = document.querySelector('details.user-menu') as HTMLDetailsElement
    expect(details).toBeTruthy()
    expect(details.open).toBe(false)

    // Open the dropdown
    details.open = true
    expect(details.open).toBe(true)

    // Clicking inside the dropdown keeps it open
    fireEvent.mouseDown(screen.getByText('test@example.com'))
    expect(details.open).toBe(true)

    // Clicking outside on the page content closes it
    fireEvent.mouseDown(screen.getByTestId('page-content'))
    expect(details.open).toBe(false)
  })

  it('closes dropdown when Escape key is pressed', () => {
    renderLayout()
    const details = document.querySelector('details.user-menu') as HTMLDetailsElement
    details.open = true
    expect(details.open).toBe(true)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(details.open).toBe(false)
  })

  it('closes dropdown when clicking a link inside it', () => {
    renderLayout()
    const details = document.querySelector('details.user-menu') as HTMLDetailsElement
    details.open = true
    expect(details.open).toBe(true)

    const profileLink = details.querySelector('.user-menu-panel a') as HTMLAnchorElement
    expect(profileLink).toBeTruthy()
    fireEvent.click(profileLink)
    expect(details.open).toBe(false)
  })
})
