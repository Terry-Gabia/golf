import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, CloudSun, CloudRain, CloudSnow, Cloud, Sun, Wind, Droplets, X } from 'lucide-react'

interface HourData {
  time: string
  temp: number
  pop: number
  rainfall: string
  pty: number
  ptyText: string
  sky: number
  skyText: string
  windSpeed: number
  humidity: number
}

interface DayPeriodData {
  label: string
  weatherText: string
  pop: number
}

interface DayData {
  date: string
  minTemp: number
  maxTemp: number
  source: 'short' | 'mid'
  weatherText: string
  precipProbability: number
  periods: DayPeriodData[]
  hours: HourData[]
}

interface ForecastResponse {
  ccName: string
  location: { lat: number; lng: number; nx: number; ny: number }
  baseDate: string
  baseTime: string
  midBaseDate?: string
  midBaseTime?: string
  days: DayData[]
}

interface CourseItem {
  region: string
  name: string
  address: string
  holes: number | null
  detailType: string | null
}

interface CourseCatalogResponse {
  regions: string[]
  courses: CourseItem[]
}

function getSkyIcon(sky: number, pty: number) {
  if (pty === 1 || pty === 2 || pty === 5 || pty === 6) return CloudRain
  if (pty === 3 || pty === 7) return CloudSnow
  if (sky === 1) return Sun
  if (sky === 3) return CloudSun
  return Cloud
}

function getSkyColor(sky: number, pty: number) {
  if (pty > 0) return 'text-blue-400'
  if (sky === 1) return 'text-yellow-400'
  if (sky === 3) return 'text-orange-300'
  return 'text-gray-400'
}

function formatDate(dateStr: string) {
  const y = dateStr.slice(0, 4)
  const m = parseInt(dateStr.slice(4, 6))
  const d = parseInt(dateStr.slice(6, 8))
  const date = new Date(parseInt(y), m - 1, d)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayName = dayNames[date.getDay()]
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  return { display: `${m}/${d} (${dayName})`, isWeekend }
}

function formatTime(timeStr: string) {
  return `${timeStr.slice(0, 2)}시`
}

function getGolfScore(day: DayData) {
  const avgTemp = (day.minTemp + day.maxTemp) / 2
  const maxPop = day.hours.length > 0 ? Math.max(...day.hours.map((h) => h.pop)) : day.precipProbability
  const avgWind = day.hours.length > 0
    ? day.hours.reduce((s, h) => s + h.windSpeed, 0) / day.hours.length
    : 0
  let score = 100
  if (avgTemp < 5 || avgTemp > 35) score -= 30
  else if (avgTemp < 10 || avgTemp > 30) score -= 15
  if (maxPop > 60) score -= 30
  else if (maxPop > 30) score -= 15
  if (avgWind > 10) score -= 20
  else if (avgWind > 6) score -= 10
  return Math.max(0, Math.min(100, score))
}

function getRainfallScore(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized === '0mm' || normalized === '강수없음') return 0
  if (normalized.includes('미만')) {
    const match = normalized.match(/\d+(\.\d+)?/)
    return match ? Number.parseFloat(match[0]) : 0.5
  }
  const matches = normalized.match(/\d+(\.\d+)?/g)
  if (!matches) return 0
  return Math.max(...matches.map(Number.parseFloat))
}

function getPeakRainfall(hours: HourData[]) {
  const rainyHours = hours.filter((hour) => getRainfallScore(hour.rainfall) > 0)
  if (rainyHours.length === 0) return null
  return rainyHours.reduce((peak, hour) => (
    getRainfallScore(hour.rainfall) > getRainfallScore(peak.rainfall) ? hour : peak
  ))
}

function getScoreLabel(score: number) {
  if (score >= 80) return { text: '최고', color: 'text-green-500', bg: 'bg-green-500/10' }
  if (score >= 60) return { text: '좋음', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  if (score >= 40) return { text: '보통', color: 'text-yellow-500', bg: 'bg-yellow-500/10' }
  return { text: '비추', color: 'text-red-500', bg: 'bg-red-500/10' }
}

export function WeatherTab() {
  const [courseName, setCourseName] = useState('블루언용인CC')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState('전체')
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchForecast = useCallback(async (name: string) => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/weather/forecast?ccName=${encodeURIComponent(name)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '알 수 없는 오류' }))
        throw new Error(err.error)
      }
      setData(await res.json())
      setCourseName(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : '날씨 정보를 가져올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchForecast(courseName)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setCoursesLoading(true)
        const res = await fetch('/api/weather/courses')
        if (!res.ok) {
          throw new Error('골프장 목록을 불러올 수 없습니다.')
        }
        const catalog = (await res.json()) as CourseCatalogResponse
        setCourses(catalog.courses)
        setRegions(catalog.regions)
      } catch (err) {
        console.error(err)
      } finally {
        setCoursesLoading(false)
      }
    }

    fetchCourses()
  }, [])

  const handleSearch = (name: string) => {
    setShowSearch(false)
    setSearchInput('')
    fetchForecast(name)
  }

  const filteredCourses = useMemo(() => {
    const keyword = searchInput.trim()

    return courses
      .filter((course) => selectedRegion === '전체' || course.region === selectedRegion)
      .filter((course) => (
        !keyword
          || course.name.includes(keyword)
          || course.address.includes(keyword)
      ))
      .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'))
  }, [courses, searchInput, selectedRegion])

  return (
    <div>
      {/* 헤더: 골프장명 + 검색 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">골프장 날씨</h2>
      </div>

      {/* 현재 골프장 + 변경 버튼 */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/30"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{courseName}</span>
          <span className="ml-auto text-xs text-muted-foreground">변경</span>
        </button>
      </div>

      {/* 검색 패널 */}
      {showSearch && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchInput.trim()) handleSearch(searchInput.trim())
                if (e.key === 'Escape') setShowSearch(false)
              }}
              placeholder="골프장명 입력..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <button
              onClick={() => setShowSearch(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {['전체', ...regions].map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  region === selectedRegion
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {region}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{selectedRegion} 골프장</span>
            <span>{filteredCourses.length}개</span>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {coursesLoading ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                골프장 목록을 불러오는 중...
              </div>
            ) : filteredCourses.length > 0 ? (
              filteredCourses.map((course) => (
                <button
                  key={`${course.region}-${course.name}`}
                  onClick={() => handleSearch(course.name)}
                  className={`block w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    course.name === courseName
                      ? 'border-primary/40 bg-primary/8'
                      : 'border-border bg-background hover:border-primary/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{course.name}</div>
                    <div className="shrink-0 text-[11px] text-muted-foreground">
                      {course.holes ? `${course.holes}홀` : course.region}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{course.address}</div>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                조건에 맞는 골프장이 없습니다.
              </div>
            )}
          </div>

          {searchInput.trim() && !filteredCourses.length && (
            <button
              onClick={() => handleSearch(searchInput.trim())}
              className="mt-2 w-full rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
            >
              "{searchInput.trim()}" 검색
            </button>
          )}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">예보를 불러오는 중...</p>
        </div>
      )}

      {/* 에러 */}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => fetchForecast(courseName)}
            className="mt-3 rounded-lg bg-muted px-4 py-2 text-sm hover:bg-muted/80"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 예보 데이터 */}
      {data && !loading && (
        <div className="space-y-3">
          {data.days.map((day) => {
            const { display, isWeekend } = formatDate(day.date)
            const score = getGolfScore(day)
            const scoreLabel = getScoreLabel(score)
            const maxPop = day.hours.length > 0 ? Math.max(...day.hours.map((h) => h.pop)) : day.precipProbability
            const peakRain = day.hours.length > 0 ? getPeakRainfall(day.hours) : null
            const dayHours = day.hours.filter((h) => {
              const hr = parseInt(h.time.slice(0, 2))
              return hr >= 9 && hr <= 18
            })
            const repHour = day.hours.length > 0
              ? (dayHours.length > 0
                ? dayHours.reduce((worst, h) => (h.pty > worst.pty || h.sky > worst.sky ? h : worst), dayHours[0])
                : day.hours[0])
              : null
            const SkyIcon = repHour ? getSkyIcon(repHour.sky, repHour.pty) : Sun
            const skyColor = repHour ? getSkyColor(repHour.sky, repHour.pty) : 'text-yellow-400'
            const summaryText = repHour
              ? (repHour.pty > 0 ? repHour.ptyText : repHour.skyText)
              : day.weatherText

            return (
              <div key={day.date} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* 일별 요약 */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <SkyIcon className={`h-8 w-8 shrink-0 ${skyColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isWeekend ? 'text-red-400' : ''}`}>
                        {display}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${scoreLabel.bg} ${scoreLabel.color}`}>
                        골프 {scoreLabel.text}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {Math.round(day.minTemp)}° / <span className="font-medium text-foreground">{Math.round(day.maxTemp)}°</span>
                      </span>
                      <span>{summaryText}</span>
                      {maxPop > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Droplets className="h-3 w-3 text-blue-400" />
                          {maxPop}%
                        </span>
                      )}
                      {peakRain && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <CloudRain className="h-3 w-3" />
                          {peakRain.rainfall}
                        </span>
                      )}
                      {repHour && (
                        <span className="flex items-center gap-0.5">
                          <Wind className="h-3 w-3" />
                          {repHour.windSpeed}m/s
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold">{Math.round(day.maxTemp)}°</span>
                  </div>
                </div>

                {day.hours.length > 0 ? (
                  <div className="border-t border-border bg-muted/20 px-1 py-2">
                    <div className="flex gap-1 overflow-x-auto scrollbar-none">
                      {day.hours.map((h) => {
                        const HIcon = getSkyIcon(h.sky, h.pty)
                        const hColor = getSkyColor(h.sky, h.pty)
                        const hr = parseInt(h.time.slice(0, 2))
                        const isDayHour = hr >= 7 && hr <= 19
                        const hasRainfall = getRainfallScore(h.rainfall) > 0

                        return (
                          <div
                            key={h.time}
                            className={`flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-lg border border-transparent px-2.5 py-2 ${
                              isDayHour ? 'bg-background/70' : 'opacity-55'
                            } ${hasRainfall ? 'ring-1 ring-blue-400/20' : ''}`}
                          >
                            <span className="text-[10px] text-muted-foreground">{formatTime(h.time)}</span>
                            <HIcon className={`h-4 w-4 ${hColor}`} />
                            <span className="text-xs font-medium">{Math.round(h.temp)}°</span>
                            <span className={`text-[10px] font-medium ${hasRainfall ? 'text-blue-400' : 'text-muted-foreground'}`}>
                              {hasRainfall ? h.rainfall : '-'}
                            </span>
                            <span className="text-[10px] text-blue-400">{h.pop > 0 ? `${h.pop}%` : ' '}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
                    {day.periods.map((period) => (
                      <div key={`${day.date}-${period.label}`} className="bg-muted/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{period.label}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                            <Droplets className="h-3 w-3" />
                            {period.pop}%
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{period.weatherText}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* 안내 */}
          <div className="space-y-1 text-center text-[11px] text-muted-foreground">
            <p>
              시간별 강수량은 단기예보 범위에서 제공됩니다. 그 이후 4~10일 구간은 중기예보 기준 일별/오전·오후 강수확률로 표시합니다.
            </p>
            <p>
              단기예보 {data.baseDate.slice(4, 6)}/{data.baseDate.slice(6)} {data.baseTime.slice(0, 2)}시 발표
              {data.midBaseDate && data.midBaseTime ? ` · 중기예보 ${data.midBaseDate.slice(4, 6)}/${data.midBaseDate.slice(6)} ${data.midBaseTime.slice(0, 2)}시 발표` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
