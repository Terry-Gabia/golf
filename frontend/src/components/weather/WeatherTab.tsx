import { useEffect, useState, useCallback } from 'react'
import { Search, CloudSun, CloudRain, CloudSnow, Cloud, Sun, Wind, Droplets, X } from 'lucide-react'

interface HourData {
  time: string
  temp: number
  pop: number
  pty: number
  ptyText: string
  sky: number
  skyText: string
  windSpeed: number
  humidity: number
}

interface DayData {
  date: string
  minTemp: number
  maxTemp: number
  hours: HourData[]
}

interface ForecastResponse {
  ccName: string
  location: { lat: number; lng: number; nx: number; ny: number }
  baseDate: string
  baseTime: string
  days: DayData[]
}

const POPULAR_COURSES = [
  '용인 블루언 CC', '분당그린피아', '남서울CC', '양지파인', '곤지암',
  '기흥CC', '용인CC', '수원CC', '안양CC', '군포CC',
  '이천', '여주', '리베라CC',
]

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
  const maxPop = Math.max(...day.hours.map((h) => h.pop))
  const avgWind = day.hours.reduce((s, h) => s + h.windSpeed, 0) / day.hours.length
  let score = 100
  if (avgTemp < 5 || avgTemp > 35) score -= 30
  else if (avgTemp < 10 || avgTemp > 30) score -= 15
  if (maxPop > 60) score -= 30
  else if (maxPop > 30) score -= 15
  if (avgWind > 10) score -= 20
  else if (avgWind > 6) score -= 10
  return Math.max(0, Math.min(100, score))
}

function getScoreLabel(score: number) {
  if (score >= 80) return { text: '최고', color: 'text-green-500', bg: 'bg-green-500/10' }
  if (score >= 60) return { text: '좋음', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  if (score >= 40) return { text: '보통', color: 'text-yellow-500', bg: 'bg-yellow-500/10' }
  return { text: '비추', color: 'text-red-500', bg: 'bg-red-500/10' }
}

export function WeatherTab() {
  const [courseName, setCourseName] = useState('용인 블루언 CC')
  const [searchInput, setSearchInput] = useState('')
  const [showSearch, setShowSearch] = useState(false)
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

  const handleSearch = (name: string) => {
    setShowSearch(false)
    setSearchInput('')
    fetchForecast(name)
  }

  const filteredCourses = searchInput.trim()
    ? POPULAR_COURSES.filter((c) => c.includes(searchInput.trim()))
    : POPULAR_COURSES

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
          <div className="flex flex-wrap gap-1.5">
            {filteredCourses.map((name) => (
              <button
                key={name}
                onClick={() => handleSearch(name)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  name === courseName
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {name}
              </button>
            ))}
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
            const maxPop = Math.max(...day.hours.map((h) => h.pop))
            // 대표 하늘상태: 낮 시간(9~18시) 중 가장 안 좋은 상태
            const dayHours = day.hours.filter((h) => {
              const hr = parseInt(h.time.slice(0, 2))
              return hr >= 9 && hr <= 18
            })
            const repHour = dayHours.length > 0
              ? dayHours.reduce((worst, h) => (h.pty > worst.pty || h.sky > worst.sky ? h : worst), dayHours[0])
              : day.hours[0]
            const SkyIcon = repHour ? getSkyIcon(repHour.sky, repHour.pty) : Sun
            const skyColor = repHour ? getSkyColor(repHour.sky, repHour.pty) : 'text-yellow-400'

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
                      {maxPop > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Droplets className="h-3 w-3 text-blue-400" />
                          {maxPop}%
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

                {/* 시간대별 스크롤 */}
                <div className="border-t border-border bg-muted/20 px-1 py-2">
                  <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
                    {day.hours.map((h) => {
                      const HIcon = getSkyIcon(h.sky, h.pty)
                      const hColor = getSkyColor(h.sky, h.pty)
                      const hr = parseInt(h.time.slice(0, 2))
                      const isDayHour = hr >= 7 && hr <= 19
                      return (
                        <div
                          key={h.time}
                          className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 ${
                            isDayHour ? '' : 'opacity-50'
                          }`}
                        >
                          <span className="text-[10px] text-muted-foreground">{formatTime(h.time)}</span>
                          <HIcon className={`h-4 w-4 ${hColor}`} />
                          <span className="text-xs font-medium">{Math.round(h.temp)}°</span>
                          {h.pop > 0 && (
                            <span className="text-[10px] text-blue-400">{h.pop}%</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* 안내 */}
          <p className="text-center text-[11px] text-muted-foreground">
            기상청 단기예보 기준 · {data.baseDate.slice(4, 6)}/{data.baseDate.slice(6)} {data.baseTime.slice(0, 2)}시 발표
          </p>
        </div>
      )}
    </div>
  )
}
