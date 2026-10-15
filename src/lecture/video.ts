export function videoSource(value: string): { kind: 'embed' | 'file'; src: string } | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const youtube = host === 'youtu.be' ? url.pathname.slice(1) : ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host) ? url.searchParams.get('v') || /^\/(?:embed|shorts)\/([^/]+)/.exec(url.pathname)?.[1] : null
    if (youtube && /^[\w-]{11}$/.test(youtube)) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${youtube}` }
    const rutube = host === 'rutube.ru' ? /^\/(?:video|play\/embed)\/([a-f0-9]{32})\/?$/i.exec(url.pathname)?.[1] : null
    if (rutube) return { kind: 'embed', src: `https://rutube.ru/play/embed/${rutube}/` }
    if (/\.mp4$/i.test(url.pathname)) return { kind: 'file', src: url.href }
  } catch { /* Invalid URLs never become iframe sources. */ }
  return null
}
