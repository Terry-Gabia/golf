import express from 'express'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(express.json())

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const BASE_URL = process.env.BASE_URL || 'https://peterpar.up.railway.app'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ========== 네이버 OAuth API ==========

// 1. 네이버 로그인 시작 → 네이버 인증 페이지로 리다이렉트
app.get('/api/auth/naver', (req, res) => {
  const state = Math.random().toString(36).substring(2)
  const redirectUri = `${BASE_URL}/api/auth/naver/callback`
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  res.redirect(naverAuthUrl)
})

// 2. 네이버 콜백 → 토큰 교환 → 유저 정보 → Supabase 로그인
app.get('/api/auth/naver/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.redirect(`/?error=no_code`)

  try {
    const redirectUri = `${BASE_URL}/api/auth/naver/callback`

    // 토큰 교환
    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return res.redirect(`/?error=token_failed`)
    }

    // 유저 정보 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData = await profileRes.json()
    if (profileData.resultcode !== '00') {
      return res.redirect(`/?error=profile_failed`)
    }

    const { email, name, nickname, id: naverId } = profileData.response
    const userEmail = email || `naver_${naverId}@naver.placeholder`

    // Supabase에서 유저 찾기 또는 생성
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
        return res.redirect(`/?error=create_failed`)
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
      return res.redirect(`/?error=session_failed`)
    }

    const { hashed_token } = linkData.properties
    res.redirect(`/?token_hash=${hashed_token}&type=magiclink`)
  } catch (err) {
    console.error('Naver auth error:', err)
    res.redirect(`/?error=server_error`)
  }
})

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// ========== 프론트엔드 정적 파일 서빙 ==========
const distPath = path.join(__dirname, '..', 'frontend', 'dist')
app.use(express.static(distPath))

// SPA fallback: /api가 아닌 모든 경로는 index.html로
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'))
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Serving frontend from: ${distPath}`)
})
