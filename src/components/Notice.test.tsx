import { StrictMode, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Notice } from './ui'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers(); document.getElementById('notification-stack')?.remove() })

describe('Notice', () => {
  it('renders outside page layout and disappears at 1500ms in StrictMode', () => {
    const { container } = render(<StrictMode><Notice text="Практика опубликована"/></StrictMode>)
    expect(container.textContent).toBe('')
    expect(screen.getByRole('status').parentElement?.id).toBe('notification-stack')
    act(() => vi.advanceTimersByTime(1499))
    expect(screen.getByRole('status').textContent).toBe('Практика опубликована')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('can show an identical message again after dismissal', () => {
    function Example() {
      const [text, setText] = useState('')
      return <><button onClick={() => setText('Сохранено')}>Save</button><Notice text={text} onDismiss={() => setText('')}/></>
    }
    render(<Example/>)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('Save'))
      expect(screen.getByRole('status').textContent).toBe('Сохранено')
      act(() => vi.advanceTimersByTime(1500))
      expect(screen.queryByRole('status')).toBeNull()
    }
  })

  it('restarts the timer for a new message and stacks simultaneous notices', () => {
    const view = render(<><Notice text="Saved"/><Notice text="Failed" kind="error"/></>)
    expect(screen.getByRole('alert').parentElement).toBe(screen.getByRole('status').parentElement)
    act(() => vi.advanceTimersByTime(1000))
    view.rerender(<><Notice text="Published"/><Notice text="Failed" kind="error"/></>)
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Published')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('cancels dismissal on unmount', () => {
    const onDismiss = vi.fn()
    const view = render(<Notice text="Saved" onDismiss={onDismiss}/>)
    view.unmount()
    act(() => vi.advanceTimersByTime(1500))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
