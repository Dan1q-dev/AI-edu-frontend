import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { cleanup, render, screen } from '@testing-library/react'
import { blocksToDocument, documentToBlocks } from './document'
import { videoSource } from './video'
import { lectureExtensions } from './LectureDocumentEditor'
import { RichLessonContent } from '../components/RichLessonContent'
import type { Block } from '../api'

const blocks: Block[] = [
  { type: 'TEXT', position: 0, content: '## Раздел\n\nПервый абзац', media: null, config: { align: 'center' } },
  { type: 'IMAGE', position: 1, content: 'Подпись', media: 7, media_url: '/api/v1/media/7/', config: { alt: 'Схема', width: 'reading' } },
  { type: 'TEXT', position: 2, content: 'Последний абзац', media: null, config: {} },
]
let editor: Editor | undefined
afterEach(() => { editor?.destroy(); editor = undefined; cleanup() })

describe('unified lecture document', () => {
  it('retains imported colors, highlights, nested lists and starting numbers through the editor and reader', () => {
    const item = (text: string) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
    editor = new Editor({ extensions: lectureExtensions(), content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Colored source', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#dc2626' } }, { type: 'highlight', attrs: { color: '#fef08a' } }] }] },
      { type: 'orderedList', attrs: { start: 4 }, content: [{ ...item('Step four'), content: [...item('Step four').content, { type: 'bulletList', content: [item('Nested bullet')] }] }, item('Step five')] },
    ] } })
    const saved = documentToBlocks(editor.getJSON())
    expect(blocksToDocument(saved)).toEqual(editor.getJSON())
    const { container } = render(<RichLessonContent value={saved[0]!.content}/>)
    expect(container.querySelector('span')?.style.color).toBe('rgb(220, 38, 38)')
    expect(container.querySelector('mark')?.style.backgroundColor).toBe('rgb(254, 240, 138)')
    expect(container.querySelector('strong')?.textContent).toBe('Colored source')
    expect(container.querySelector('ol')?.start).toBe(4)
    expect(container.querySelector('ol > li > ul > li')?.textContent).toBe('Nested bullet')
  })

  it('ignores CSS expressions in imported colors', () => {
    const { container } = render(<RichLessonContent value={JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Safe text', marks: [{ type: 'textStyle', attrs: { color: 'var(--untrusted)' } }, { type: 'highlight', attrs: { color: 'url(https://example.test)' } }] }] }] })}/>)
    expect(container.querySelector('span')?.getAttribute('style')).toBeNull()
    expect(container.querySelector('mark')?.style.backgroundColor).toBe('rgb(255, 255, 0)')
  })

  it('round-trips legacy text, formatting, image references and order through the existing API format', () => {
    editor = new Editor({ extensions: lectureExtensions(), content: blocksToDocument(blocks) })
    const saved = documentToBlocks(editor.getJSON())
    expect(saved.map(block => block.type)).toEqual(['TEXT', 'IMAGE', 'TEXT'])
    expect(saved[1]).toMatchObject({ media: 7, content: 'Подпись', config: { alt: 'Схема', width: 'reading' } })
    expect(JSON.parse(saved[0]!.content).content[0]).toMatchObject({ type: 'heading', attrs: { level: 2, textAlign: 'center' } })
    expect(saved[2]!.content).toContain('Последний абзац')
    expect(blocksToDocument(saved)).toEqual(editor.getJSON())
  })

  it('selects across former block boundaries and undoes removing an image with the same history', () => {
    editor = new Editor({ extensions: lectureExtensions(), content: blocksToDocument(blocks) })
    const original = editor.getJSON()
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
    expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toContain('Последний абзац')
    let imagePos = -1
    editor.state.doc.forEach((node, pos) => { if (node.type.name === 'lectureImage') imagePos = pos })
    editor.commands.deleteRange({ from: imagePos, to: imagePos + 1 })
    expect(documentToBlocks(editor.getJSON()).some(block => block.type === 'IMAGE')).toBe(false)
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getJSON()).toEqual(original)
    expect(editor.schema.nodes.callout!.validContent(editor.schema.nodes.lectureImage!.create({ media: 7 }).content)).toBe(false)
    expect(editor.schema.nodes.callout!.contentMatch.matchType(editor.schema.nodes.lectureImage!)).toBeNull()
  })

  it('preserves and renders tables, callouts, separators, video and math after saving', () => {
    editor = new Editor({ extensions: lectureExtensions(), content: { type: 'doc', content: [
      { type: 'callout', attrs: { tone: 'important' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Проверьте единицы' }] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Величина' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Скорость' }] }] }] }] },
      { type: 'horizontalRule' }, { type: 'blockMath', attrs: { latex: 'E=mc^2' } },
      { type: 'lectureVideo', attrs: { src: 'https://youtu.be/dQw4w9WgXcQ' } },
    ] } })
    const saved = documentToBlocks(editor.getJSON())
    const restored = blocksToDocument(saved)
    expect(restored).toEqual(editor.getJSON())
    render(<RichLessonContent value={saved[0]!.content}/>)
    expect(screen.getByText('Проверьте единицы').closest('aside')?.dataset.tone).toBe('important')
    expect(screen.getByRole('columnheader', { name: 'Величина' })).toBeTruthy()
    expect(document.querySelector('.katex')).toBeTruthy()
    expect(document.querySelector('iframe')?.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(document.querySelector('hr')).toBeTruthy()
  })

  it('splits long documents into API-sized text rows without losing paragraphs', () => {
    const content = Array.from({ length: 20 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `${index}:` + 'x'.repeat(4000) }] }))
    const document = { type: 'doc', content }
    const saved = documentToBlocks(document)
    expect(saved.length).toBeGreaterThan(1)
    expect(saved.every(block => block.content.length < 50000)).toBe(true)
    expect(blocksToDocument(saved)).toEqual(document)
  })

  it('resolves uploaded image placeholders after undo and redo, including a late completion', () => {
    editor = new Editor({ extensions: lectureExtensions(), content: { type: 'doc', content: [{ type: 'paragraph' }] } })
    editor.commands.insertContent({ type: 'lectureImage', attrs: { uploadId: 'pending' } })
    editor.commands.undo()
    editor.storage.lectureImage.uploads.set('pending', { media: 9, src: '/api/v1/media/9/' })
    editor.view.dispatch(editor.state.tr)
    editor.commands.redo()
    expect(documentToBlocks(editor.getJSON()).find(block => block.type === 'IMAGE')?.media).toBe(9)
    expect(editor.getJSON().content?.find(node => node.type === 'lectureImage')?.attrs?.uploadId).toBeNull()
    editor.commands.undo(); editor.commands.redo()
    expect(documentToBlocks(editor.getJSON()).find(block => block.type === 'IMAGE')?.media).toBe(9)
  })

  it.each(['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://evil.test/embed/abc', 'http://youtu.be/dQw4w9WgXcQ', 'https://user:password@example.test/a.mp4'])('rejects unsafe or unsupported video sources: %s', value => {
    expect(videoSource(value)).toBeNull()
  })
  it('accepts only known embed providers or direct HTTPS MP4 files', () => {
    expect(videoSource('https://rutube.ru/video/' + 'a'.repeat(32) + '/')).toEqual({ kind: 'embed', src: 'https://rutube.ru/play/embed/' + 'a'.repeat(32) + '/' })
    expect(videoSource('https://cdn.example.test/lecture.mp4?token=test')?.kind).toBe('file')
  })
})
