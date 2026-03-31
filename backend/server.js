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
const KMA_API_KEY = process.env.KMA_API_KEY

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

// ========== 기상청 날씨 API (단기예보 프록시) ==========

// 위경도 → 기상청 격자좌표(nx, ny) 변환
function latLngToGrid(lat, lng) {
  const RE = 6371.00877 // 지구 반경(km)
  const GRID = 5.0 // 격자 간격(km)
  const SLAT1 = 30.0 // 투영 위도1(degree)
  const SLAT2 = 60.0 // 투영 위도2(degree)
  const OLON = 126.0 // 기준점 경도(degree)
  const OLAT = 38.0 // 기준점 위도(degree)
  const XO = 43 // 기준점 X좌표(GRID)
  const YO = 136 // 기준점 Y좌표(GRID)
  const DEGRAD = Math.PI / 180.0

  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD
  const slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD
  const olat = OLAT * DEGRAD

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lng * DEGRAD - olon
  if (theta > Math.PI) theta -= 2.0 * Math.PI
  if (theta < -Math.PI) theta += 2.0 * Math.PI
  theta *= sn

  const x = Math.floor(ra * Math.sin(theta) + XO + 0.5)
  const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
  return { nx: x, ny: y }
}

// 자주 가는 골프장 좌표 매핑 (위경도)
const GOLF_COURSE_COORDS = {
  '분당그린피아': { lat: 37.4023, lng: 127.1278 },
  '그린피아': { lat: 37.4023, lng: 127.1278 },
  '남서울CC': { lat: 37.3250, lng: 127.0800 },
  '남서울': { lat: 37.3250, lng: 127.0800 },
  '용인CC': { lat: 37.2340, lng: 127.2010 },
  '수원CC': { lat: 37.2630, lng: 127.0280 },
  '안양CC': { lat: 37.3820, lng: 126.9510 },
  '군포CC': { lat: 37.3530, lng: 126.9340 },
  '양지파인': { lat: 37.2280, lng: 127.2870 },
  '곤지암': { lat: 37.3410, lng: 127.3350 },
  '기흥CC': { lat: 37.2540, lng: 127.1040 },
  '이천': { lat: 37.2720, lng: 127.4350 },
  '여주': { lat: 37.2840, lng: 127.6360 },
  '리베라CC': { lat: 37.3160, lng: 127.2580 },
}

// 골프장명으로 좌표 찾기 (부분 매칭 지원)
function findCourseCoords(ccName) {
  const name = ccName.trim()
  if (GOLF_COURSE_COORDS[name]) return GOLF_COURSE_COORDS[name]
  // 부분 매칭
  for (const [key, coords] of Object.entries(GOLF_COURSE_COORDS)) {
    if (name.includes(key) || key.includes(name)) return coords
  }
  return null
}

// 기상청 API 기준 시각 계산 (초단기실황: 매시 정각, 40분 이후 제공)
function getBaseDateTime() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000) // UTC → KST
  let hour = kst.getUTCHours()
  const min = kst.getUTCMinutes()
  // 40분 이전이면 이전 시간 사용
  if (min < 40) hour = hour - 1
  if (hour < 0) {
    hour = 23
    kst.setUTCDate(kst.getUTCDate() - 1)
  }
  const baseDate = `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`
  const baseTime = `${String(hour).padStart(2, '0')}00`
  return { baseDate, baseTime }
}

// 강수형태 코드 → 텍스트
const PTY_MAP = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울눈날림', 7: '눈날림' }

app.get('/api/weather', async (req, res) => {
  const { ccName, lat, lng } = req.query
  if (!ccName && (!lat || !lng)) {
    return res.status(400).json({ error: '골프장명(ccName) 또는 좌표(lat, lng)가 필요합니다.' })
  }
  if (!KMA_API_KEY) {
    return res.status(500).json({ error: '기상청 API 키가 설정되지 않았습니다.' })
  }

  try {
    let latitude, longitude, address
    if (lat && lng) {
      latitude = parseFloat(lat)
      longitude = parseFloat(lng)
      address = ccName || `${lat}, ${lng}`
    } else {
      const coords = findCourseCoords(ccName)
      if (!coords) {
        return res.status(404).json({ error: `"${ccName}" 골프장 좌표를 찾을 수 없습니다. 관리자에게 좌표 등록을 요청해주세요.` })
      }
      latitude = coords.lat
      longitude = coords.lng
      address = ccName
    }

    const { nx, ny } = latLngToGrid(latitude, longitude)
    const { baseDate, baseTime } = getBaseDateTime()

    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(KMA_API_KEY)}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
    const kmaRes = await fetch(url)
    const kmaData = await kmaRes.json()

    const items = kmaData?.response?.body?.items?.item
    if (!items || items.length === 0) {
      return res.status(502).json({ error: '기상청에서 날씨 정보를 가져올 수 없습니다.', detail: kmaData?.response?.header })
    }

    // 카테고리별 데이터 파싱
    const weather = {}
    for (const item of items) {
      weather[item.category] = item.obsrValue
    }

    res.json({
      ccName: address,
      location: { lat: latitude, lng: longitude, nx, ny },
      baseDate,
      baseTime,
      weather: {
        temperature: parseFloat(weather.T1H || 0),   // 기온 (℃)
        humidity: parseFloat(weather.REH || 0),       // 습도 (%)
        rainfall: parseFloat(weather.RN1 || 0),       // 1시간 강수량 (mm)
        precipType: parseInt(weather.PTY || 0),        // 강수형태 코드
        precipTypeText: PTY_MAP[parseInt(weather.PTY || 0)] || '알 수 없음',
        windSpeed: parseFloat(weather.WSD || 0),       // 풍속 (m/s)
        windEW: parseFloat(weather.UUU || 0),          // 동서풍 (m/s)
        windNS: parseFloat(weather.VVV || 0),          // 남북풍 (m/s)
      },
    })
  } catch (err) {
    console.error('Weather API error:', err)
    res.status(500).json({ error: '날씨 정보 조회 중 오류가 발생했습니다.' })
  }
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
