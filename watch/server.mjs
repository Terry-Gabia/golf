import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const baseDir = fileURLToPath(new URL('./dist', import.meta.url))
const indexPath = join(baseDir, 'index.html')

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

function resolvePath(pathname) {
  const normalizedPath = normalize(decodeURIComponent(pathname))
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '')
  return join(baseDir, normalizedPath)
}

function sendFile(res, filePath) {
  const extension = extname(filePath).toLowerCase()
  const type = mimeTypes[extension] ?? 'application/octet-stream'
  const cacheControl = extension === '.html'
    ? 'no-cache'
    : filePath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600'

  res.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Type': type,
  })
  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Bad Request')
    return
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  const filePath = resolvePath(url.pathname === '/' ? '/index.html' : url.pathname)

  try {
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }

    const html = await readFile(indexPath)
    res.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    })
    res.end(html)
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(error instanceof Error ? error.message : 'Internal Server Error')
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Watch server listening on ${port}`)
})
