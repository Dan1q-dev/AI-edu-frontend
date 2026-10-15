import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { useI18n } from '../i18n'
import { videoSource } from './video'

export type ImageStorage = {
  uploads: Map<string, { media: number; src: string } | null>
  replace?: (pos: number, file: File) => void
}
declare module '@tiptap/core' { interface Storage { lectureImage: ImageStorage } }

function ImageView({ node, selected, updateAttributes, extension, getPos, editor }: NodeViewProps) {
  const { t } = useI18n()
  return <NodeViewWrapper as="figure" className={`lecture-image ${node.attrs.width === 'reading' ? 'reading-width' : ''} ${selected ? 'is-selected' : ''}`}>
    {node.attrs.src ? <img src={node.attrs.src} alt={node.attrs.alt || node.attrs.caption || ''}/> : <div className="lecture-image-loading">{t('Загрузка изображения…')}</div>}
    {node.attrs.caption && !selected && <figcaption>{node.attrs.caption}</figcaption>}
    {selected && editor.isEditable && <div className="lecture-image-settings" contentEditable={false}>
      <label className="lecture-image-replace">{t('Заменить изображение')}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(node.attrs.uploadId)} onChange={event => { const file = event.target.files?.[0], pos = getPos(); if (file && pos !== undefined) (extension.storage as ImageStorage).replace?.(pos, file); event.currentTarget.value = '' }}/></label>
      <label>{t('Подпись')}<input value={node.attrs.caption} onChange={event => { if (editor.isEditable) updateAttributes({ caption: event.target.value }) }}/></label>
      <label>{t('Альтернативный текст')}<input value={node.attrs.alt} onChange={event => { if (editor.isEditable) updateAttributes({ alt: event.target.value }) }}/></label>
      <label>{t('Ширина изображения')}<select value={node.attrs.width} onChange={event => { if (editor.isEditable) updateAttributes({ width: event.target.value }) }}><option value="wide">{t('Широкая')}</option><option value="reading">{t('По ширине текста')}</option></select></label>
    </div>}
  </NodeViewWrapper>
}

export const LectureImage = Node.create<Record<string, never>, ImageStorage>({
  name: 'lectureImage', group: 'lectureMedia', atom: true, draggable: true,
  addAttributes: () => ({ media: { default: null }, src: { default: '' }, caption: { default: '' }, alt: { default: '' }, width: { default: 'wide' }, uploadId: { default: null } }),
  parseHTML: () => [{ tag: 'figure[data-lecture-image]' }],
  renderHTML: ({ HTMLAttributes }) => ['figure', mergeAttributes(HTMLAttributes, { 'data-lecture-image': '' }), ['img', { src: HTMLAttributes.src, alt: HTMLAttributes.alt }], ['figcaption', {}, HTMLAttributes.caption]],
  addNodeView: () => ReactNodeViewRenderer(ImageView),
  addStorage: () => ({ uploads: new Map() }),
  addProseMirrorPlugins() {
    const uploads = this.storage.uploads
    return [new Plugin({ appendTransaction: (_transactions, _old, state) => {
      let tr = state.tr
      let changed = false
      // Resolving uploads outside history keeps undo/redo from reviving stale placeholders.
      state.doc.descendants((node, pos) => {
        const id = node.attrs.uploadId as string | null
        if (node.type.name !== 'lectureImage' || !id || !uploads.has(id)) return
        const result = uploads.get(id)
        const at = tr.mapping.map(pos)
        if (result) tr = tr.setNodeMarkup(at, undefined, { ...node.attrs, ...result, uploadId: null })
        else if (node.attrs.media) tr = tr.setNodeMarkup(at, undefined, { ...node.attrs, uploadId: null })
        else tr = tr.delete(at, at + node.nodeSize)
        changed = true
      })
      return changed ? tr.setMeta('addToHistory', false) : null
    } })]
  },
})

// Images must remain top-level so each keeps its own media reference in the API.
export const LectureRoot = Node.create({ name: 'doc', topNode: true, content: '(block | lectureMedia)+' })

export const Callout = Node.create({
  name: 'callout', group: 'block', content: 'block+', defining: true,
  addAttributes: () => ({ tone: { default: 'note', parseHTML: element => element.getAttribute('data-tone'), renderHTML: attrs => ({ 'data-tone': attrs.tone }) } }),
  parseHTML: () => [{ tag: 'aside[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'lecture-callout' }), 0],
  addKeyboardShortcuts() { return {
    'Mod-Shift-0': () => this.editor.commands.lift('callout'),
    Enter: () => {
      const { $from, empty } = this.editor.state.selection
      const depth = $from.depth - 1
      if (!empty || depth < 1 || $from.parent.content.size || $from.node(depth).type.name !== 'callout' || $from.index(depth) !== $from.node(depth).childCount - 1) return false
      return this.editor.commands.lift('callout')
    },
  } },
})

function VideoView({ node, selected }: NodeViewProps) {
  const { t } = useI18n()
  const source = videoSource(String(node.attrs.src ?? ''))
  return <NodeViewWrapper className={`lecture-video ${selected ? 'is-selected' : ''}`} contentEditable={false}>
    <div className="lecture-video-editor-label">{t('Видео')} · {node.attrs.src}</div>
    {source?.kind === 'file' ? <video src={source.src} controls preload="metadata"/> : source ? <iframe src={source.src} title={t('Видео лекции')} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : <p>{t('Некорректная ссылка на видео')}</p>}
  </NodeViewWrapper>
}

export const LectureVideo = Node.create({
  name: 'lectureVideo', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ src: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-lecture-video]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-lecture-video': '' })],
  addNodeView: () => ReactNodeViewRenderer(VideoView),
})
