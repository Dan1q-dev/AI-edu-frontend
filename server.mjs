import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { createGzip } from 'node:zlib'

const root = resolve('/app/dist')
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }

  let file = resolve(root, `.${pathname}`)
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    const info = await stat(file)
    if (info.isDirectory()) file = resolve(file, 'index.html')
  } catch {
    // Client-side routes should load the SPA entry point; missing assets should stay 404.
    if (extname(pathname)) {
      response.writeHead(404).end('Not found')
      return
    }
    file = resolve(root, 'index.html')
  }

  try {
    const info = await stat(file)
    if (!info.isFile()) {
      response.writeHead(404).end('Not found')
      return
    }

    const isEntry = file === resolve(root, 'index.html')
    const compressible = /\.(?:css|html|js|json|svg|txt|xml)$/i.test(file)
    const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|;|$)/i.test(request.headers['accept-encoding'] ?? '')
      && !/gzip\s*;\s*q=0(?:\.0*)?(?:,|$)/i.test(request.headers['accept-encoding'] ?? '')
    const shouldCompress = compressible && info.size >= 1024 && acceptsGzip
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': isEntry ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Vary': 'Accept-Encoding',
      ...(shouldCompress ? { 'Content-Encoding': 'gzip' } : { 'Content-Length': info.size }),
    })
    if (request.method === 'HEAD') response.end()
    else {
      const stream = createReadStream(file)
      if (shouldCompress) stream.pipe(createGzip()).pipe(response)
      else stream.pipe(response)
    }
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(3000, '0.0.0.0')
