import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const baseDir = fileURLToPath(new URL('./dist', import.meta.url))
const indexPath = join(baseDir, 'index.html')

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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

function redirect(res, url) {
  res.writeHead(302, { Location: url })
  res.end()
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

// ========== Supabase Admin ==========
async function getSupabaseAdmin() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ========== 네이버 OAuth ==========
async function handleNaverAuth(res) {
  if (!NAVER_CLIENT_ID) {
    redirect(res, '/?error=naver_not_configured')
    return
  }
  const state = Math.random().toString(36).substring(2)
  const redirectUri = `${BASE_URL}/api/auth/naver/callback`
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  redirect(res, naverAuthUrl)
}

async function handleNaverCallback(url, res) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) { redirect(res, '/?error=no_code'); return }

  try {
    const redirectUri = `${BASE_URL}/api/auth/naver/callback`

    // 토큰 교환
    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      redirect(res, '/?error=token_failed')
      return
    }

    // 유저 정보 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData = await profileRes.json()
    if (profileData.resultcode !== '00') {
      redirect(res, '/?error=profile_failed')
      return
    }

    const { email, name, nickname, id: naverId } = profileData.response
    const userEmail = email || `naver_${naverId}@naver.placeholder`

    const supabaseAdmin = await getSupabaseAdmin()

    // 유저 찾기 또는 생성
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    let user = existingUsers?.users?.find(
      (u) => u.email === userEmail || u.user_metadata?.naver_id === naverId
    )

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: {
          naver_id: naverId,
          full_name: name || nickname,
          provider: 'naver',
        },
      })
      if (createError) {
        console.error('User create error:', createError)
        redirect(res, '/?error=create_failed')
        return
      }
      user = newUser.user
    }

    // 매직 링크로 세션 발급
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
      })

    if (linkError || !linkData) {
      console.error('Link error:', linkError)
      redirect(res, '/?error=session_failed')
      return
    }

    const { hashed_token } = linkData.properties
    redirect(res, `/?token_hash=${hashed_token}&type=magiclink`)
  } catch (err) {
    console.error('Naver auth error:', err)
    redirect(res, '/?error=server_error')
  }
}

// ========== HTTP Server ==========
const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Bad Request')
    return
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)

  // API 라우팅
  if (url.pathname === '/health') {
    jsonResponse(res, { ok: true })
    return
  }

  if (url.pathname === '/api/health') {
    jsonResponse(res, { status: 'ok' })
    return
  }

  if (url.pathname === '/api/auth/naver') {
    await handleNaverAuth(res)
    return
  }

  if (url.pathname === '/api/auth/naver/callback') {
    await handleNaverCallback(url, res)
    return
  }

  // 정적 파일 서빙
  const filePath = resolvePath(url.pathname === '/' ? '/index.html' : url.pathname)

  try {
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }

    // SPA fallback
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
  console.log(`Server listening on ${port}`)
  console.log(`Naver OAuth: ${NAVER_CLIENT_ID ? 'configured' : 'not configured'}`)
})
