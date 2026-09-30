import type { ReactNode } from 'react'

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
    if (node.type === 'text') {
      let element: React.ReactNode = node.text
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') element = <strong key={key}>{element}</strong>
        else if (mark.type === 'italic') element = <em key={key}>{element}</em>
        else if (mark.type === 'code') element = <code key={key}>{element}</code>
        else if (mark.type === 'link') {
          const href = safeHref(String(mark.attrs?.href ?? ''))
          element = href ? <a key={key} href={href} rel="noreferrer">{element}</a> : <>{element}</>
        }
      }
      return element
    }
    switch (node.type) {
      case 'doc': return <>{children}</>
      case 'paragraph': return <p key={key}>{children}</p>
      case 'heading': return Number(node.attrs?.level) === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>
      case 'bulletList': return <ul key={key}>{children}</ul>
      case 'orderedList': return <ol key={key}>{children}</ol>
      case 'listItem': return <li key={key}>{children}</li>
      case 'blockquote': return <blockquote key={key}>{children}</blockquote>
      case 'codeBlock': return <pre key={key}><code>{children}</code></pre>
      case 'hardBreak': return <br key={key}/>
      default: return <>{children}</>
    }
  }
  return <>{render(document, 'root')}</>
}
