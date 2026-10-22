import { Extension } from '@tiptap/core'
import { safeTextColor } from './colors'

export const TableCellBackground = Extension.create({
  name: 'tableCellBackground',
  addGlobalAttributes() {
    return [{ types: ['tableCell', 'tableHeader'], attributes: {
      backgroundColor: {
        default: null,
        parseHTML: element => safeTextColor(element.style.backgroundColor) ?? null,
        renderHTML: attributes => { const color = safeTextColor(attributes.backgroundColor); return color ? { style: `background-color: ${color}` } : {} },
      },
    } }]
  },
})
