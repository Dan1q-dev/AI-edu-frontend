import type { ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { videoSource } from '../lecture/video'
import { safeTextColor } from '../lecture/colors'
import '../lecture/lecture-document.css'

type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] }
const safeHref = (value: string) => /^(https?:|mailto:)/i.test(value) ? value : undefined

export function RichLessonContent({ value }: { value: string }) {
  let document: Node | null = null
  try {
    const parsed = JSON.parse(value) as Node
    if (parsed?.type === 'doc' && Array.isArray(parsed.content)) document = parsed
  } catch { /* Legacy Markdown is rendered by ReactMarkdown. */ }
  if (!document) return null

  const render = (node: Node, key: string): ReactNode => {
    const children = node.content?.map((child, index) => render(child, `${key}-${index}`))
    const textAlign = node.attrs?.textAlign === 'center' || node.attrs?.textAlign === 'right' ? node.attrs.textAlign : undefined
    if (node.type === 'text') {
      let element: React.ReactNode = node.text
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') element = <strong key={key}>{element}</strong>
        else if (mark.type === 'italic') element = <em key={key}>{element}</em>
        else if (mark.type === 'code') element = <code key={key}>{element}</code>
        else if (mark.type === 'strike') element = <s key={key}>{element}</s>
        else if (mark.type === 'underline') element = <u key={key}>{element}</u>
        else if (mark.type === 'textStyle') element = <span key={key} style={{ color: safeTextColor(mark.attrs?.color) }}>{element}</span>
        else if (mark.type === 'highlight') element = <mark key={key} style={{ backgroundColor: safeTextColor(mark.attrs?.color) ?? '#ffff00', color: 'inherit' }}>{element}</mark>
        else if (mark.type === 'link') {
          const href = safeHref(String(mark.attrs?.href ?? ''))
          element = href ? <a key={key} href={href} rel="noreferrer">{element}</a> : <>{element}</>
        }
      }
      return element
    }
    switch (node.type) {
      case 'doc': return <>{children}</>
      case 'paragraph': return <p key={key} style={{ textAlign }}>{children}</p>
      case 'heading': return Number(node.attrs?.level) === 3 ? <h3 key={key} style={{ textAlign }}>{children}</h3> : <h2 key={key} style={{ textAlign }}>{children}</h2>
      case 'bulletList': return <ul key={key}>{children}</ul>
      case 'orderedList': return <ol key={key} start={Math.max(1, Math.min(1000000, Math.trunc(Number(node.attrs?.start) || 1)))}>{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key} className="lecture-quote">{children}</blockquote>
      case 'codeBlock': return <pre key={key}><code>{children}</code></pre>
      case 'hardBreak': return <br key={key}/>
      case 'horizontalRule': return <hr key={key}/>
      case 'practiceImage': {
        const media = Number(node.attrs?.media)
        if (!Number.isSafeInteger(media) || media <= 0) return null
        const caption = String(node.attrs?.caption ?? '')
        return <figure key={key}><img src={`/api/v1/media/${media}/`} alt={caption} loading="lazy"/>{caption && <figcaption>{caption}</figcaption>}</figure>
      }
      case 'table': return <table key={key}><tbody>{children}</tbody></table>
      case 'tableRow': return <tr key={key}>{children}</tr>
      case 'tableCell': return <td key={key} style={{ backgroundColor: safeTextColor(node.attrs?.backgroundColor) }} colSpan={Math.min(100, Math.max(1, Number(node.attrs?.colspan) || 1))} rowSpan={Math.min(100, Math.max(1, Number(node.attrs?.rowspan) || 1))}>{children}</td>
      case 'tableHeader': return <th key={key} style={{ backgroundColor: safeTextColor(node.attrs?.backgroundColor) }} colSpan={Math.min(100, Math.max(1, Number(node.attrs?.colspan) || 1))} rowSpan={Math.min(100, Math.max(1, Number(node.attrs?.rowspan) || 1))}>{children}</th>
      case 'callout': return <aside key={key} className="lecture-callout" data-tone={['important', 'tip'].includes(String(node.attrs?.tone)) ? String(node.attrs?.tone) : 'note'}>{children}</aside>
      case 'lectureVideo': {
        const source = videoSource(String(node.attrs?.src ?? ''))
        if (!source) return null
        return <div key={key} className="lecture-video">{source.kind === 'file' ? <video controls preload="metadata" src={source.src}/> : <iframe title="Video" src={source.src} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}</div>
      }
      case 'inlineMath': case 'blockMath': {
        const html = katex.renderToString(String(node.attrs?.latex ?? ''), { displayMode: node.type === 'blockMath', throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000 })
        return node.type === 'blockMath' ? <div key={key} className="lecture-math-block" dangerouslySetInnerHTML={{ __html: html }}/> : <span key={key} className="lecture-math-inline" dangerouslySetInnerHTML={{ __html: html }}/>
      }
      default: return <>{children}</>
    }
  }
  return <>{render(document, 'root')}</>
}
