import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const csvPath = resolve(projectRoot, 'golflist.csv')
const cachePath = resolve(projectRoot, '.cache', 'golf-course-geocode-cache.json')

function normalizeHeader(value = '') {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
}

function findColumnIndex(headers, candidates, fallbackIndex = -1) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header))
  const normalizedCandidates = candidates.map((candidate) => normalizeHeader(candidate))

  for (const candidate of normalizedCandidates) {
    const matchedIndex = normalizedHeaders.findIndex((header) => header === candidate)
    if (matchedIndex >= 0) return matchedIndex
  }

  return fallbackIndex
}

function parseCsv(content) {
  const rows = []
  let currentRow = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
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

function stringifyCsv(rows, withBom = false) {
  const body = rows
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')

  return `${withBom ? '\uFEFF' : ''}${body}\n`
}

function escapeCsvValue(value = '') {
  const stringValue = String(value)
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function parseCoordinate(value) {
  if (value == null) return null

  const parsed = Number.parseFloat(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function formatCoordinate(value) {
  return Number(value).toFixed(6)
}

function parseArgs(argv) {
  const args = {
    prepareOnly: false,
    allowNominatim: false,
    limit: Number.POSITIVE_INFINITY,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--prepare-only') {
      args.prepareOnly = true
    } else if (arg === '--allow-nominatim') {
      args.allowNominatim = true
    } else if (arg === '--limit') {
      const next = argv[index + 1]
      if (!next) throw new Error('--limit 뒤에 숫자가 필요합니다.')
      args.limit = Number.parseInt(next, 10)
      if (!Number.isFinite(args.limit) || args.limit <= 0) {
        throw new Error('--limit 값이 잘못되었습니다.')
      }
      index += 1
    }
  }

  return args
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue
      const separatorIndex = line.indexOf('=')
      if (separatorIndex < 0) continue

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      if (key && !(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // ignore missing env files
  }
}

async function loadCache() {
  try {
    const raw = await readFile(cachePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function saveCache(cache) {
  await mkdir(resolve(projectRoot, '.cache'), { recursive: true })
  await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
}

async function geocodeWithVWorld(address, apiKey) {
  for (const type of ['ROAD', 'PARCEL']) {
    const url = new URL('https://api.vworld.kr/req/address')
    url.searchParams.set('service', 'address')
    url.searchParams.set('request', 'getcoord')
    url.searchParams.set('version', '2.0')
    url.searchParams.set('crs', 'epsg:4326')
    url.searchParams.set('format', 'json')
    url.searchParams.set('type', type)
    url.searchParams.set('refine', 'true')
    url.searchParams.set('simple', 'false')
    url.searchParams.set('address', address)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PeterParGolf/1.0 (+https://peterpar.up.railway.app)',
      },
    })

    if (!response.ok) {
      throw new Error(`VWorld API 호출 실패 (${response.status})`)
    }

    const payload = await response.json()
    const point = payload?.response?.result?.point
    const lat = parseCoordinate(point?.y)
    const lng = parseCoordinate(point?.x)

    if (lat != null && lng != null) {
      return { lat, lng, provider: 'vworld' }
    }
  }

  return null
}

async function geocodeWithNominatim(queries) {
  for (const query of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'ko,en;q=0.8',
        'User-Agent': 'PeterParGolf/1.0 (+https://peterpar.up.railway.app)',
      },
    })

    if (!response.ok) {
      throw new Error(`Nominatim 호출 실패 (${response.status})`)
    }

    const payload = await response.json()
    const first = Array.isArray(payload) ? payload[0] : null
    const lat = parseCoordinate(first?.lat)
    const lng = parseCoordinate(first?.lon)

    if (lat != null && lng != null) {
      return { lat, lng, provider: 'nominatim' }
    }
  }

  return null
}

async function resolveCourseCoordinate(course, options) {
  const cacheKey = `${course.name}||${course.address}`
  if (options.cache[cacheKey]?.lat != null && options.cache[cacheKey]?.lng != null) {
    return options.cache[cacheKey]
  }

  let result = null

  if (options.vworldApiKey) {
    result = await geocodeWithVWorld(course.address, options.vworldApiKey)
  }

  if (!result && options.allowNominatim) {
    const queries = [
      `${course.name} ${course.address}, 대한민국`,
      `${course.address}, 대한민국`,
      course.address,
    ]
    result = await geocodeWithNominatim(queries)
  }

  if (result) {
    options.cache[cacheKey] = {
      lat: result.lat,
      lng: result.lng,
      provider: result.provider,
      updatedAt: new Date().toISOString(),
    }
    return options.cache[cacheKey]
  }

  return null
}

function ensureColumn(headers, label) {
  const existingIndex = findColumnIndex(headers, [label])
  if (existingIndex >= 0) return existingIndex

  headers.push(label)
  return headers.length - 1
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await loadEnvFile(resolve(projectRoot, '.env'))
  await loadEnvFile(resolve(projectRoot, 'backend', '.env'))

  const raw = await readFile(csvPath, 'utf8')
  const withBom = raw.startsWith('\uFEFF')
  const rows = parseCsv(raw.replace(/^\uFEFF/, ''))
  if (rows.length === 0) {
    throw new Error('golflist.csv가 비어 있습니다.')
  }

  const headers = rows[0]
  const regionIndex = findColumnIndex(headers, ['지역', 'region'], 0)
  const nameIndex = findColumnIndex(headers, ['업소명', '골프장명', 'name'], 1)
  const addressIndex = findColumnIndex(headers, ['소재지', '주소', 'address'], 3)
  const latIndex = ensureColumn(headers, '위도')
  const lngIndex = ensureColumn(headers, '경도')

  const cache = await loadCache()
  const vworldApiKey = process.env.VWORLD_API_KEY || process.env.VWORLD_KEY || ''
  const canGeocode = Boolean(vworldApiKey || options.allowNominatim)

  let processed = 0
  let enriched = 0
  let skipped = 0
  let failed = 0

  for (const row of rows.slice(1)) {
    while (row.length <= lngIndex) row.push('')

    const name = row[nameIndex]?.trim()
    const address = row[addressIndex]?.trim()
    const region = row[regionIndex]?.trim()
    const existingLat = parseCoordinate(row[latIndex])
    const existingLng = parseCoordinate(row[lngIndex])

    if (!name || !address || !region) {
      skipped += 1
      continue
    }

    if (existingLat != null && existingLng != null) {
      skipped += 1
      continue
    }

    if (options.prepareOnly) continue
    if (!canGeocode) continue
    if (processed >= options.limit) break

    processed += 1

    try {
      const result = await resolveCourseCoordinate({ name, address, region }, {
        cache,
        vworldApiKey,
        allowNominatim: options.allowNominatim,
      })

      if (result?.lat != null && result?.lng != null) {
        row[latIndex] = formatCoordinate(result.lat)
        row[lngIndex] = formatCoordinate(result.lng)
        enriched += 1
      } else {
        failed += 1
      }
    } catch (error) {
      failed += 1
      console.error(`[좌표 실패] ${name}:`, error.message)
    }

    if (vworldApiKey) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
    } else if (options.allowNominatim) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1100))
    }
  }

  await writeFile(csvPath, stringifyCsv(rows, withBom), 'utf8')
  await saveCache(cache)

  console.log(`CSV 준비 완료: ${csvPath}`)
  console.log(`좌표 추가: ${enriched}`)
  console.log(`좌표 유지/건너뜀: ${skipped}`)
  console.log(`좌표 실패: ${failed}`)

  if (!options.prepareOnly && !canGeocode) {
    console.log('지오코딩은 실행되지 않았습니다. VWORLD_API_KEY를 넣거나 --allow-nominatim 옵션을 사용하세요.')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
