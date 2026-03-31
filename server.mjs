import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const baseDir = fileURLToPath(new URL('./dist', import.meta.url))
const indexPath = join(baseDir, 'index.html')
const golfListPath = fileURLToPath(new URL('./golflist.csv', import.meta.url))

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const KMA_API_KEY = process.env.KMA_API_KEY
const VWORLD_API_KEY = process.env.VWORLD_API_KEY || process.env.VWORLD_KEY

let golfCourseCatalogPromise = null
const resolvedCourseCoordsCache = new Map()

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

// ========== 기상청 날씨 API ==========

function latLngToGrid(lat, lng) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0
  const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136
  const DEGRAD = Math.PI / 180.0
  const re = RE / GRID
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD
  const olon = OLON * DEGRAD, olat = OLAT * DEGRAD
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
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) }
}

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
  '블루언CC': { lat: 37.2200, lng: 127.2900 },
  '용인블루언': { lat: 37.2200, lng: 127.2900 },
  '용인 블루언 CC': { lat: 37.2200, lng: 127.2900 },
  '블루언': { lat: 37.2200, lng: 127.2900 },
  '블랙스톤리조트이천': { lat: 37.1615489, lng: 127.617879 },
  '블랙스톤리조트 이천': { lat: 37.1615489, lng: 127.617879 },
  '블랙스톤 이천': { lat: 37.1615489, lng: 127.617879 },
  '블랙스톤이천': { lat: 37.1615489, lng: 127.617879 },
}

const REGION_ADDRESS_PREFIXES = {
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
  '경기': '경기도',
  '강원': '강원특별자치도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북특별자치도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주특별자치도',
}

function parseCsv(text) {
  const rows = []
  let currentRow = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      currentRow.push(currentValue)
      currentValue = ''
      if (currentRow.some((value) => value.length > 0)) rows.push(currentRow)
      currentRow = []
      continue
    }

    currentValue += char
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)
    if (currentRow.some((value) => value.length > 0)) rows.push(currentRow)
  }

  return rows
}

function normalizeCourseName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/컨트리클럽/g, 'cc')
    .replace(/골프클럽/g, 'gc')
    .replace(/골프장/g, '')
    .replace(/클럽/g, '')
}

function normalizeCatalogHeader(value = '') {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
}

function findCatalogColumnIndex(headers, candidates, fallbackIndex = -1) {
  const normalizedHeaders = headers.map((header) => normalizeCatalogHeader(header))
  const normalizedCandidates = candidates.map((candidate) => normalizeCatalogHeader(candidate))

  for (const candidate of normalizedCandidates) {
    const matchedIndex = normalizedHeaders.findIndex((header) => header === candidate)
    if (matchedIndex >= 0) return matchedIndex
  }

  return fallbackIndex
}

function parseCatalogCoordinate(value) {
  if (value == null) return null

  const parsed = Number.parseFloat(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function getExpandedCourseAddress(course) {
  const address = course?.address?.trim()
  if (!address) return ''

  const regionPrefix = REGION_ADDRESS_PREFIXES[course.region]
  if (!regionPrefix) return address
  if (address.startsWith(regionPrefix)) return address

  return `${regionPrefix} ${address}`
}

async function loadGolfCourseCatalog() {
  if (!golfCourseCatalogPromise) {
    golfCourseCatalogPromise = readFile(golfListPath, 'utf8')
      .then((raw) => {
        const rows = parseCsv(raw.replace(/^\uFEFF/, ''))
        if (rows.length <= 1) return []

        const headers = rows[0]
        const regionIndex = findCatalogColumnIndex(headers, ['지역', 'region'], 0)
        const nameIndex = findCatalogColumnIndex(headers, ['업소명', '골프장명', 'name'], 1)
        const addressIndex = findCatalogColumnIndex(headers, ['소재지', '주소', 'address'], 3)
        const holesIndex = findCatalogColumnIndex(headers, ['홀수(홀)', '홀수', 'holes'], 5)
        const detailTypeIndex = findCatalogColumnIndex(headers, ['세부종류', '구분', 'type'], 6)
        const latIndex = findCatalogColumnIndex(headers, ['위도', 'latitude', 'lat'])
        const lngIndex = findCatalogColumnIndex(headers, ['경도', 'longitude', 'lng', 'lon'])
        const uniqueCourses = new Map()

        for (const row of rows.slice(1)) {
          const region = row[regionIndex]?.trim()
          const name = row[nameIndex]?.trim()
          const address = row[addressIndex]?.trim()
          const holes = row[holesIndex]?.trim()
          const detailType = row[detailTypeIndex]?.trim()
          const lat = latIndex >= 0 ? parseCatalogCoordinate(row[latIndex]) : null
          const lng = lngIndex >= 0 ? parseCatalogCoordinate(row[lngIndex]) : null

          if (!region || !name || !address) continue

          const normalizedName = normalizeCourseName(name)
          if (uniqueCourses.has(normalizedName)) continue

          uniqueCourses.set(normalizedName, {
            region,
            name,
            address,
            holes: holes ? Number.parseInt(holes, 10) : null,
            detailType: detailType || null,
            lat,
            lng,
            normalizedName,
          })
        }

        return Array.from(uniqueCourses.values())
          .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'))
      })
      .catch((error) => {
        console.error('Golf course catalog load error:', error)
        return []
      })
  }

  return golfCourseCatalogPromise
}

async function handleWeatherCourses(res) {
  const courses = await loadGolfCourseCatalog()
  const regions = [...new Set(courses.map((course) => course.region))]
    .sort((left, right) => left.localeCompare(right, 'ko-KR'))

  jsonResponse(res, { regions, courses })
}

async function geocodeWithVWorld(address) {
  if (!VWORLD_API_KEY) return null

  for (const type of ['ROAD', 'PARCEL']) {
    const geocodeUrl = new URL('https://api.vworld.kr/req/address')
    geocodeUrl.searchParams.set('service', 'address')
    geocodeUrl.searchParams.set('request', 'getcoord')
    geocodeUrl.searchParams.set('version', '2.0')
    geocodeUrl.searchParams.set('crs', 'epsg:4326')
    geocodeUrl.searchParams.set('format', 'json')
    geocodeUrl.searchParams.set('type', type)
    geocodeUrl.searchParams.set('refine', 'true')
    geocodeUrl.searchParams.set('simple', 'false')
    geocodeUrl.searchParams.set('address', address)
    geocodeUrl.searchParams.set('key', VWORLD_API_KEY)

    const response = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'PeterParGolf/1.0 (+https://peterpar.up.railway.app)',
      },
    })

    if (!response.ok) {
      throw new Error(`VWorld Geocode API 호출 실패 (${response.status})`)
    }

    const data = await response.json()
    const point = data?.response?.result?.point
    const lat = parseCatalogCoordinate(point?.y)
    const lng = parseCatalogCoordinate(point?.x)

    if (lat != null && lng != null) {
      return { lat, lng }
    }
  }

  return null
}

async function geocodeWithNominatim(query) {
  const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`
  const response = await fetch(geocodeUrl, {
    headers: {
      'Accept-Language': 'ko,en;q=0.8',
      'User-Agent': 'PeterParGolf/1.0 (+https://peterpar.up.railway.app)',
    },
  })

  if (!response.ok) {
    throw new Error(`Geocode API 호출 실패 (${response.status})`)
  }

  const data = await response.json()
  const first = Array.isArray(data) ? data[0] : null
  if (!first?.lat || !first?.lon) return null

  return {
    lat: Number.parseFloat(first.lat),
    lng: Number.parseFloat(first.lon),
  }
}

async function geocodeQuery(query, options = {}) {
  if (options.addressOnly) {
    try {
      const coords = await geocodeWithVWorld(query)
      if (coords) return coords
    } catch (error) {
      console.error('VWorld geocode error:', query, error)
    }
  }

  return geocodeWithNominatim(query)
}

async function resolveCourseCoords(ccName) {
  const name = ccName.trim()
  const courses = await loadGolfCourseCatalog()
  const normalizedName = normalizeCourseName(name)
  const matchedCourse = courses.find((course) => (
    course.normalizedName === normalizedName
      || normalizedName.includes(course.normalizedName)
      || course.normalizedName.includes(normalizedName)
  ))

  if (matchedCourse?.lat != null && matchedCourse?.lng != null) {
    const coords = { lat: matchedCourse.lat, lng: matchedCourse.lng }
    resolvedCourseCoordsCache.set(matchedCourse.normalizedName, coords)
    return coords
  }

  if (GOLF_COURSE_COORDS[name]) return GOLF_COURSE_COORDS[name]

  for (const [key, coords] of Object.entries(GOLF_COURSE_COORDS)) {
    if (name.includes(key) || key.includes(name)) return coords
  }

  if (!matchedCourse) return null

  if (resolvedCourseCoordsCache.has(matchedCourse.normalizedName)) {
    return resolvedCourseCoordsCache.get(matchedCourse.normalizedName)
  }

  const expandedAddress = getExpandedCourseAddress(matchedCourse)
  const geocodeQueries = [
    { query: expandedAddress, addressOnly: true },
    { query: matchedCourse.address, addressOnly: true },
    { query: `${matchedCourse.name} ${expandedAddress}, 대한민국`, addressOnly: false },
    { query: `${matchedCourse.name} ${matchedCourse.address}, 대한민국`, addressOnly: false },
    { query: `${expandedAddress}, 대한민국`, addressOnly: false },
    { query: `${matchedCourse.address}, 대한민국`, addressOnly: false },
  ].filter((item, index, array) => item.query && array.findIndex((candidate) => candidate.query === item.query && candidate.addressOnly === item.addressOnly) === index)

  for (const { query, addressOnly } of geocodeQueries) {
    try {
      const coords = await geocodeQuery(query, { addressOnly })
      if (coords) {
        resolvedCourseCoordsCache.set(matchedCourse.normalizedName, coords)
        return coords
      }
    } catch (error) {
      console.error('Course geocode error:', query, error)
    }
  }

  return null
}

function getBaseDateTime() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  let hour = kst.getUTCHours()
  if (kst.getUTCMinutes() < 40) hour--
  if (hour < 0) { hour = 23; kst.setUTCDate(kst.getUTCDate() - 1) }
  const baseDate = `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`
  const baseTime = `${String(hour).padStart(2, '0')}00`
  return { baseDate, baseTime }
}

const PTY_MAP = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울눈날림', 7: '눈날림' }

// 단기예보 기준 시각 계산 (발표: 0200,0500,0800,1100,1400,1700,2000,2300)
function getFcstBaseDateTime() {
  const FCST_TIMES = [2, 5, 8, 11, 14, 17, 20, 23]
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  let hour = kst.getUTCHours()
  const min = kst.getUTCMinutes()
  // 발표 후 약 10분 뒤 API 제공, 여유있게 처리
  if (min < 10) hour--
  // 가장 가까운 이전 발표 시각 찾기
  let baseHour = FCST_TIMES[0]
  for (const t of FCST_TIMES) {
    if (t <= hour) baseHour = t
  }
  // 0시~1시인 경우 전날 2300 사용
  if (hour < 2) {
    baseHour = 23
    kst.setUTCDate(kst.getUTCDate() - 1)
  }
  const baseDate = `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`
  const baseTime = `${String(baseHour).padStart(2, '0')}00`
  return { baseDate, baseTime }
}

const SKY_MAP = { 1: '맑음', 3: '구름많음', 4: '흐림' }
const MID_FORECAST_REGION = {
  landRegId: '11B00000',
  tempRegId: '11B20601',
}

function parseYmdToUtcDate(ymd) {
  return new Date(Date.UTC(
    Number.parseInt(ymd.slice(0, 4), 10),
    Number.parseInt(ymd.slice(4, 6), 10) - 1,
    Number.parseInt(ymd.slice(6, 8), 10),
  ))
}

function formatUtcDateToYmd(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function normalizeRainfall(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '강수없음' || raw === '0' || raw === '0.0' || raw === '0mm') return '0mm'
  return raw.endsWith('mm') ? raw : `${raw}mm`
}

function getMidBaseDateTime() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const hour = kst.getUTCHours()
  const minute = kst.getUTCMinutes()
  const date = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))

  if (hour < 6 || (hour === 6 && minute < 10)) {
    date.setUTCDate(date.getUTCDate() - 1)
    return { baseDate: formatUtcDateToYmd(date), baseTime: '1800' }
  }

  if (hour < 18 || (hour === 18 && minute < 10)) {
    return { baseDate: formatUtcDateToYmd(date), baseTime: '0600' }
  }

  return { baseDate: formatUtcDateToYmd(date), baseTime: '1800' }
}

async function fetchKmaJson(apiUrl, label) {
  const response = await fetch(apiUrl)
  const text = await response.text()

  if (!response.ok || text.startsWith('<') || text === 'Unauthorized') {
    throw new Error(`${label} API 호출 실패 (${response.status}) ${text.substring(0, 120)}`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`${label} API 응답 파싱 실패`)
  }

  return data
}

function getFirstKmaItem(data) {
  const items = data?.response?.body?.items?.item
  if (Array.isArray(items)) return items[0] ?? null
  return items ?? null
}

function buildMidTermDays(landItem, tempItem, baseDate) {
  if (!landItem || !tempItem) return []

  const base = parseYmdToUtcDate(baseDate)
  const days = []

  for (let offset = 4; offset <= 10; offset += 1) {
    const date = formatUtcDateToYmd(addUtcDays(base, offset))
    const minTemp = Number.parseFloat(tempItem[`taMin${offset}`] ?? '')
    const maxTemp = Number.parseFloat(tempItem[`taMax${offset}`] ?? '')

    if (Number.isNaN(minTemp) || Number.isNaN(maxTemp)) continue

    if (offset <= 7) {
      const amPop = Number.parseInt(landItem[`rnSt${offset}Am`] ?? '0', 10)
      const pmPop = Number.parseInt(landItem[`rnSt${offset}Pm`] ?? '0', 10)
      const amWeather = landItem[`wf${offset}Am`] ?? ''
      const pmWeather = landItem[`wf${offset}Pm`] ?? ''

      days.push({
        date,
        minTemp,
        maxTemp,
        source: 'mid',
        weatherText: pmWeather || amWeather || '정보 없음',
        precipProbability: Math.max(amPop || 0, pmPop || 0),
        periods: [
          { label: '오전', weatherText: amWeather || '정보 없음', pop: amPop || 0 },
          { label: '오후', weatherText: pmWeather || '정보 없음', pop: pmPop || 0 },
        ],
        hours: [],
      })
      continue
    }

    const pop = Number.parseInt(landItem[`rnSt${offset}`] ?? '0', 10)
    const weatherText = landItem[`wf${offset}`] ?? '정보 없음'

    days.push({
      date,
      minTemp,
      maxTemp,
      source: 'mid',
      weatherText,
      precipProbability: pop || 0,
      periods: [
        { label: '하루', weatherText, pop: pop || 0 },
      ],
      hours: [],
    })
  }

  return days
}

async function handleForecast(url, res) {
  const ccName = url.searchParams.get('ccName')
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')

  if (!ccName && (!lat || !lng)) {
    jsonResponse(res, { error: '골프장명(ccName) 또는 좌표(lat, lng)가 필요합니다.' }, 400)
    return
  }
  if (!KMA_API_KEY) {
    jsonResponse(res, { error: '기상청 API 키가 설정되지 않았습니다.' }, 500)
    return
  }

  try {
    let latitude, longitude, address
    if (lat && lng) {
      latitude = parseFloat(lat); longitude = parseFloat(lng)
      address = ccName || `${lat}, ${lng}`
    } else {
      const coords = await resolveCourseCoords(ccName)
      if (!coords) {
        jsonResponse(res, { error: `"${ccName}" 골프장 좌표를 찾을 수 없습니다.` }, 404)
        return
      }
      latitude = coords.lat; longitude = coords.lng; address = ccName
    }

    const { nx, ny } = latLngToGrid(latitude, longitude)
    const { baseDate, baseTime } = getFcstBaseDateTime()

    const apiUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(KMA_API_KEY)}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
    const kmaData = await fetchKmaJson(apiUrl, '단기예보')

    const items = kmaData?.response?.body?.items?.item
    if (!items || items.length === 0) {
      jsonResponse(res, { error: '예보 데이터를 가져올 수 없습니다.', detail: kmaData?.response?.header }, 502)
      return
    }

    // 날짜+시간별로 그룹핑
    const byDateTime = {}
    for (const item of items) {
      const key = `${item.fcstDate}_${item.fcstTime}`
      if (!byDateTime[key]) byDateTime[key] = { date: item.fcstDate, time: item.fcstTime }
      byDateTime[key][item.category] = item.fcstValue
    }

    // 일별로 집계
    const byDate = {}
    for (const slot of Object.values(byDateTime)) {
      const d = slot.date
      if (!byDate[d]) {
        byDate[d] = {
          date: d,
          minTemp: 999,
          maxTemp: -999,
          source: 'short',
          weatherText: '',
          precipProbability: 0,
          periods: [],
          hours: [],
        }
      }
      const temp = parseFloat(slot.TMP || slot.T3H || 0)
      if (temp < byDate[d].minTemp) byDate[d].minTemp = temp
      if (temp > byDate[d].maxTemp) byDate[d].maxTemp = temp
      // TMN/TMX가 있으면 사용
      if (slot.TMN) byDate[d].minTemp = Math.min(byDate[d].minTemp, parseFloat(slot.TMN))
      if (slot.TMX) byDate[d].maxTemp = Math.max(byDate[d].maxTemp, parseFloat(slot.TMX))
      const pop = parseInt(slot.POP || 0)
      const pty = parseInt(slot.PTY || 0)
      const sky = parseInt(slot.SKY || 1)
      byDate[d].hours.push({
        time: slot.time,
        temp,
        pop,
        rainfall: normalizeRainfall(slot.PCP),
        pty,
        ptyText: PTY_MAP[pty] || '없음',
        sky,
        skyText: SKY_MAP[sky] || '맑음',
        windSpeed: parseFloat(slot.WSD || 0),
        humidity: parseInt(slot.REH || 0),
      })
      byDate[d].precipProbability = Math.max(byDate[d].precipProbability, pop)
    }

    const shortDays = Object.values(byDate)
      .map((day) => ({
        ...day,
        weatherText: day.hours.find((slot) => parseInt(slot.time.slice(0, 2), 10) >= 12)?.pty > 0
          ? day.hours.find((slot) => parseInt(slot.time.slice(0, 2), 10) >= 12)?.ptyText ?? '없음'
          : day.hours.find((slot) => parseInt(slot.time.slice(0, 2), 10) >= 12)?.skyText ?? '맑음',
        hours: day.hours.sort((a, b) => a.time.localeCompare(b.time)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const { landRegId, tempRegId } = MID_FORECAST_REGION
    const { baseDate: midBaseDate, baseTime: midBaseTime } = getMidBaseDateTime()
    const tmFc = `${midBaseDate}${midBaseTime}`
    const landUrl = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${encodeURIComponent(KMA_API_KEY)}&pageNo=1&numOfRows=10&dataType=JSON&regId=${landRegId}&tmFc=${tmFc}`
    const tempUrl = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey=${encodeURIComponent(KMA_API_KEY)}&pageNo=1&numOfRows=10&dataType=JSON&regId=${tempRegId}&tmFc=${tmFc}`

    let midDays = []
    try {
      const [landData, tempData] = await Promise.all([
        fetchKmaJson(landUrl, '중기육상예보'),
        fetchKmaJson(tempUrl, '중기기온예보'),
      ])
      midDays = buildMidTermDays(getFirstKmaItem(landData), getFirstKmaItem(tempData), midBaseDate)
    } catch (midError) {
      console.error('Mid forecast API error:', midError)
    }

    const days = [
      ...shortDays,
      ...midDays.filter((midDay) => !shortDays.some((shortDay) => shortDay.date === midDay.date)),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10)

    jsonResponse(res, {
      ccName: address,
      location: { lat: latitude, lng: longitude, nx, ny },
      baseDate, baseTime,
      midBaseDate,
      midBaseTime,
      days,
    })
  } catch (err) {
    console.error('Forecast API error:', err)
    jsonResponse(res, { error: '예보 조회 중 오류가 발생했습니다.' }, 500)
  }
}

async function handleWeather(url, res) {
  const ccName = url.searchParams.get('ccName')
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')

  if (!ccName && (!lat || !lng)) {
    jsonResponse(res, { error: '골프장명(ccName) 또는 좌표(lat, lng)가 필요합니다.' }, 400)
    return
  }
  if (!KMA_API_KEY) {
    jsonResponse(res, { error: '기상청 API 키가 설정되지 않았습니다.' }, 500)
    return
  }

  try {
    let latitude, longitude, address
    if (lat && lng) {
      latitude = parseFloat(lat)
      longitude = parseFloat(lng)
      address = ccName || `${lat}, ${lng}`
    } else {
      const coords = await resolveCourseCoords(ccName)
      if (!coords) {
        jsonResponse(res, { error: `"${ccName}" 골프장 좌표를 찾을 수 없습니다. 관리자에게 좌표 등록을 요청해주세요.` }, 404)
        return
      }
      latitude = coords.lat
      longitude = coords.lng
      address = ccName
    }

    const { nx, ny } = latLngToGrid(latitude, longitude)
    const { baseDate, baseTime } = getBaseDateTime()

    const apiUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(KMA_API_KEY)}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`
    const kmaRes = await fetch(apiUrl)
    const kmaText = await kmaRes.text()

    if (!kmaRes.ok || kmaText.startsWith('<') || kmaText === 'Unauthorized') {
      console.error('KMA API error:', kmaRes.status, kmaText.substring(0, 200))
      jsonResponse(res, { error: '기상청 API 호출에 실패했습니다.', status: kmaRes.status }, 502)
      return
    }

    let kmaData
    try { kmaData = JSON.parse(kmaText) } catch {
      console.error('KMA API parse error:', kmaText.substring(0, 200))
      jsonResponse(res, { error: '기상청 응답을 파싱할 수 없습니다.' }, 502)
      return
    }

    const items = kmaData?.response?.body?.items?.item
    if (!items || items.length === 0) {
      jsonResponse(res, { error: '기상청에서 날씨 정보를 가져올 수 없습니다.', detail: kmaData?.response?.header }, 502)
      return
    }

    const weather = {}
    for (const item of items) weather[item.category] = item.obsrValue

    jsonResponse(res, {
      ccName: address,
      location: { lat: latitude, lng: longitude, nx, ny },
      baseDate, baseTime,
      weather: {
        temperature: parseFloat(weather.T1H || 0),
        humidity: parseFloat(weather.REH || 0),
        rainfall: parseFloat(weather.RN1 || 0),
        precipType: parseInt(weather.PTY || 0),
        precipTypeText: PTY_MAP[parseInt(weather.PTY || 0)] || '알 수 없음',
        windSpeed: parseFloat(weather.WSD || 0),
        windEW: parseFloat(weather.UUU || 0),
        windNS: parseFloat(weather.VVV || 0),
      },
    })
  } catch (err) {
    console.error('Weather API error:', err)
    jsonResponse(res, { error: '날씨 정보 조회 중 오류가 발생했습니다.' }, 500)
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

  if (url.pathname === '/api/weather') {
    await handleWeather(url, res)
    return
  }

  if (url.pathname === '/api/weather/courses') {
    await handleWeatherCourses(res)
    return
  }

  if (url.pathname === '/api/weather/forecast') {
    await handleForecast(url, res)
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
