import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '../api'
import { AssignmentConfigEditor } from './AssignmentConfigEditor'
import { defaultTaskConfig } from './commonTask'

vi.mock('../api', () => ({ api: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

describe('assignment source upload', () => {
  it('does not report content changes on mount or when saving toggles editability', () => {
    const onChange = vi.fn()
    const config = defaultTaskConfig()
    const view = render(<AssignmentConfigEditor config={config} disabled={false} onChange={onChange}/>)
    expect(onChange).not.toHaveBeenCalled()
    view.rerender(<AssignmentConfigEditor config={config} disabled onChange={onChange}/>)
    view.rerender(<AssignmentConfigEditor config={config} disabled={false} onChange={onChange}/>)
    expect(onChange).not.toHaveBeenCalled()
  })
  it('uploads a file and stores its download metadata while retaining current edits', async () => {
    const onChange = vi.fn()
    let finish!: (value: unknown) => void
    vi.mocked(api).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const config = defaultTaskConfig()
    const view = render(<AssignmentConfigEditor config={config} disabled={false} onChange={onChange}/>)
    fireEvent.change(screen.getByLabelText('Исходный документ'), { target: { files: [new File(['text'], 'source.txt')] } })
    const edited = { ...config, criteria: [{ title: 'Edited criterion', description: '', is_required: true }] }
    view.rerender(<AssignmentConfigEditor config={edited} disabled={false} onChange={onChange}/>)
    const source = { media: 7, name: 'source.txt', size: 4, url: '/api/v1/media/7/download/' }
    finish(source)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...edited, source_url: '', source_files: [source] }))
    expect(vi.mocked(api).mock.calls[0][2]).toBeInstanceOf(FormData)
  })

  it('rejects files larger than 10 MB before uploading and allows removal', async () => {
    const onChange = vi.fn()
    const source = { media: 7, name: 'source.txt', size: 4, url: '/api/v1/media/7/download/' }
    const config = { ...defaultTaskConfig(), source_files: [source] }
    render(<AssignmentConfigEditor config={config} disabled={false} onChange={onChange}/>)
    const file = new File(['text'], 'large.txt')
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(screen.getByLabelText('Исходный документ'), { target: { files: [file] } })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(api).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Удалить файл: source.txt' }))
    expect(onChange).toHaveBeenCalledWith({ ...config, source_files: [] })
  })
})
