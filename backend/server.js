import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(cors())
app.use(express.json())

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://peterpar.up.railway.app'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1. 네이버 로그인 시작 → 네이버 인증 페이지로 리다이렉트
app.get('/api/auth/naver', (req, res) => {
  const state = Math.random().toString(36).substring(2)
  const redirectUri = `${BACKEND_URL}/api/auth/naver/callback`
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  res.redirect(naverAuthUrl)
})

// 2. 네이버 콜백 → 토큰 교환 → 유저 정보 → Supabase 로그인
app.get('/api/auth/naver/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.redirect(`${FRONTEND_URL}?error=no_code`)

  try {
    const redirectUri = `${BACKEND_URL}/api/auth/naver/callback`

    // 토큰 교환
    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return res.redirect(`${FRONTEND_URL}?error=token_failed`)
    }

    // 유저 정보 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData = await profileRes.json()
    if (profileData.resultcode !== '00') {
      return res.redirect(`${FRONTEND_URL}?error=profile_failed`)
    }

    const { email, name, nickname, id: naverId } = profileData.response
    const userEmail = email || `naver_${naverId}@naver.placeholder`

    // Supabase에서 유저 찾기 또는 생성
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    let user = existingUsers?.users?.find(
      (u) => u.email === userEmail || u.user_metadata?.naver_id === naverId
    )

    if (!user) {
      // 새 유저 생성
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
        return res.redirect(`${FRONTEND_URL}?error=create_failed`)
      }
      user = newUser.user
    }

    // 매직 링크 생성 (OTP)으로 세션 발급
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
      })

    if (linkError || !linkData) {
      console.error('Link error:', linkError)
      return res.redirect(`${FRONTEND_URL}?error=session_failed`)
    }

    // Supabase 인증 토큰으로 프론트엔드에 전달
    const { hashed_token } = linkData.properties
    const verifyUrl = `${FRONTEND_URL}?token_hash=${hashed_token}&type=magiclink`
    res.redirect(verifyUrl)
  } catch (err) {
    console.error('Naver auth error:', err)
    res.redirect(`${FRONTEND_URL}?error=server_error`)
  }
})

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
