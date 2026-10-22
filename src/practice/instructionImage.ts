import { Node } from '@tiptap/core'

// Keep an explicit media ID in the instruction for publication access checks.
export const InstructionImage = Node.create({
  name: 'practiceImage', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ media: { default: null }, caption: { default: '' } }),
  parseHTML: () => [{ tag: 'figure[data-practice-media]', getAttrs: element => ({ media: Number(element.getAttribute('data-practice-media')), caption: element.querySelector('figcaption')?.textContent ?? '' }) }],
  renderHTML: ({ node }) => ['figure', { 'data-practice-media': node.attrs.media },
    ['img', { src: `/api/v1/media/${Number(node.attrs.media)}/`, alt: node.attrs.caption }],
    ['figcaption', {}, node.attrs.caption]],
})
