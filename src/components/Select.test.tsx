import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Select } from './Select'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const statuses = <><option value="">Все статусы</option><option value="active">Активен</option><option value="inactive">Неактивен</option></>

describe('shared Select', () => {
  it('keeps its label, updates controlled values and emits a native change event for forms', () => {
    const changed = vi.fn()
    function Form() {
      const [value, setValue] = useState('')
      return <form aria-label="Фильтры"><label>Статус<Select name="status" value={value} onChange={event => {
        changed(event.target.value, event.target.name, event.currentTarget.tagName)
        setValue(event.target.value)
      }}>{statuses}</Select></label></form>
    }
    render(<Form/> )
    const trigger = screen.getByRole('combobox', { name: 'Статус' })
    expect(trigger.textContent).toBe('Все статусы')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'Все статусы' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('option', { name: 'Неактивен' }))
    expect(changed).toHaveBeenCalledWith('inactive', 'status', 'SELECT')
    expect(trigger.textContent).toBe('Неактивен')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('status')).toBe('inactive')
  })

  it('supports arrows, Home, End and Enter without submitting, and skips disabled options', () => {
    const submit = vi.fn(event => event.preventDefault())
    render(<form onSubmit={submit}><Select aria-label="Курс" defaultValue="one"><option value="one">Первый</option>
      <option value="two" disabled>Недоступный</option><option value="three">Третий</option><option value="four">Четвёртый</option></Select></form>)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Третий' }).id)
    fireEvent.keyDown(trigger, { key: 'End' })
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Четвёртый' }).id)
    fireEvent.keyDown(trigger, { key: 'Home' })
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger.textContent).toBe('Четвёртый')
    expect(submit).not.toHaveBeenCalled()
  })

  it('cancels navigation with Escape and does not close the containing dialog', () => {
    const parentKey = vi.fn()
    render(<div role="dialog" onKeyDown={parentKey}><Select aria-label="Статус">{statuses}</Select></div>)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(within(screen.getByRole('dialog')).getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    parentKey.mockClear()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger.textContent).toBe('Все статусы')
    expect(parentKey).not.toHaveBeenCalled()
  })

  it('closes on outside pointer, Tab and blur, and never renders a modal backdrop', () => {
    render(<><label>Статус<Select>{statuses}</Select></label><button>Далее</button></>)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(document.querySelector('.modal-backdrop')).toBeNull()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(trigger)
    fireEvent.blur(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('matches Cyrillic text and repeated characters, with selection only on Enter while open', () => {
    render(<Select aria-label="Курс"><option value="a">Алгебра</option><option value="b">Анализ</option><option value="p">Программирование</option></Select>)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'а' })
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Анализ' }).id)
    fireEvent.keyDown(trigger, { key: 'а' })
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Алгебра' }).id)
    fireEvent.keyDown(trigger, { key: 'н' })
    fireEvent.keyDown(trigger, { key: 'Escape' })
    fireEvent.keyDown(trigger, { key: 'п' })
    // Reopening starts a fresh typeahead sequence.
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'п' })
    fireEvent.keyDown(trigger, { key: 'р' })
    expect(trigger.textContent).toBe('Алгебра')
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(trigger.textContent).toBe('Программирование')
  })

  it('preserves default values, optgroup labels, disabled groups and form reset', () => {
    render(<form aria-label="Настройки"><Select aria-label="Курс" name="course" defaultValue="b">
      <optgroup label="Доступные"><option value="a">Алгебра</option><option value="b">Биология</option></optgroup>
      <optgroup label="Архив" disabled><option value="c">Химия</option></optgroup>
    </Select></form>)
    const trigger = screen.getByRole('combobox')
    expect(trigger.textContent).toBe('Биология')
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'Химия' }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('option', { name: 'Химия' }))
    expect(trigger.textContent).toBe('Биология')
    fireEvent.click(screen.getByRole('option', { name: 'Алгебра' }))
    fireEvent.reset(screen.getByRole('form'))
    expect(trigger.textContent).toBe('Биология')
  })

  it('blocks empty required values and focuses the visible control', () => {
    render(<form aria-label="Настройки"><label>Статус<Select required name="status">{statuses}</Select></label></form>)
    const form = screen.getByRole('form') as HTMLFormElement
    expect(form.checkValidity()).toBe(false)
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Активен' }))
    expect(form.checkValidity()).toBe(true)
  })

  it('respects disabled fields, disabled fieldsets, empty lists and asynchronously loaded options', () => {
    const view = render(<fieldset disabled><Select aria-label="Статус">{statuses}</Select></fieldset>)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
    view.rerender(<Select disabled aria-label="Статус">{statuses}</Select>)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
    view.rerender(<Select aria-label="Статус" value="active"/>)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
    view.rerender(<Select aria-label="Статус" value="active">{statuses}</Select>)
    expect(screen.getByRole('combobox').textContent).toBe('Активен')
  })

  it('opens above a low trigger and constrains the list to the viewport and trigger width', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 700, bottom: 744, left: 40, right: 340, width: 300, height: 44, x: 40, y: 700, toJSON: () => ({}) })
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(500)
    render(<Select aria-label="Статус">{statuses}</Select>)
    fireEvent.click(screen.getByRole('combobox'))
    const list = screen.getByRole('listbox')
    expect(list.style.width).toBe('300px')
    expect(list.style.bottom).toBe(`${window.innerHeight - 700 + 6}px`)
    expect(list.style.maxHeight).toBe('288px')
  })
})
