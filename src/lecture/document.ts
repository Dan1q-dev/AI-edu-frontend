import type { JSONContent } from '@tiptap/core'
import type { Block } from '../api'
import { parseLessonContent } from '../components/LessonTextEditor'

// Keep media in IMAGE rows: the backend uses those rows for access and deletion checks.
export function blocksToDocument(blocks: Block[]): JSONContent {
  const content = blocks.flatMap(block => {
    if (block.type === 'IMAGE') return [{ type: 'lectureImage', attrs: { media: block.media, src: block.media_url || (block.media ? `/api/v1/media/${block.media}/` : ''), caption: block.content, alt: String(block.config.alt ?? ''), width: block.config.width ?? 'wide', uploadId: null } }]
    const nodes = parseLessonContent(block.content).content ?? []
    return nodes.map(node => block.config.align && ['paragraph', 'heading'].includes(node.type ?? '')
      ? { ...node, attrs: { ...node.attrs, textAlign: block.config.align } } : node)
  })
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function documentToBlocks(document: JSONContent): Block[] {
  const blocks: Block[] = []
  let content: JSONContent[] = []
  const flush = () => {
    if (content.length) blocks.push({ type: 'TEXT', position: blocks.length, content: JSON.stringify({ type: 'doc', content }), media: null, config: {} })
    content = []
  }
  for (const node of document.content ?? []) {
    if (node.type === 'lectureImage') {
      flush()
      if (node.attrs?.media) blocks.push({ type: 'IMAGE', position: blocks.length, content: String(node.attrs.caption ?? ''), media: Number(node.attrs.media), media_url: `/api/v1/media/${node.attrs.media}/`, config: { alt: node.attrs.alt ?? '', width: node.attrs.width ?? 'wide' } })
    } else {
      // Preserve the API's per-block size limit for long documents.
      if (content.length && JSON.stringify({ type: 'doc', content: [...content, node] }).length > 45000) flush()
      content.push(node)
    }
  }
  flush()
  return blocks
}

