import { useEffect, useState } from 'react'
import { X, Thermometer, Droplets, Wind, CloudRain, CloudSnow, CloudSun, Cloud } from 'lucide-react'

interface CurrentWeatherResponse {
  ccName: string
  location: { lat: number; lng: number; nx: number; ny: number }
  baseDate: string
  baseTime: string
  weather: {
    temperature: number
    humidity: number
    rainfall: number
    precipType: number
    precipTypeText: string
    windSpeed: number
    windEW: number
    windNS: number
  }
}

interface ForecastHourData {
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

interface ForecastDayPeriod {
  label: string
  weatherText: string
  pop: number
}

interface ForecastDayData {
  date: string
  minTemp: number
  maxTemp: number
  source: 'short' | 'mid'
  weatherText: string
  precipProbability: number
  periods: ForecastDayPeriod[]
  hours: ForecastHourData[]
}

interface ForecastResponse {
  ccName: string
  location: { lat: number; lng: number; nx: number; ny: number }
  baseDate: string
  baseTime: string
  midBaseDate?: string
  midBaseTime?: string
  days: ForecastDayData[]
}

interface Props {
  ccName: string
  playDate: string
  playTime?: string | null
  onClose: () => void
}

// 강수형태 코드에 따른 아이콘 + 색상
function getWeatherIcon(precipType: number) {
  switch (precipType) {
    case 1: case 2: case 5: case 6:
      return { Icon: CloudRain, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/10' }
    case 3: case 7:
      return { Icon: CloudSnow, color: 'text-sky-300', bg: 'from-sky-400/20 to-sky-500/10' }
    default:
      return { Icon: CloudSun, color: 'text-yellow-400', bg: 'from-amber-400/20 to-orange-400/10' }
  }
}

function getForecastIcon(sky: number, precipType: number) {
  if (precipType === 1 || precipType === 2 || precipType === 5 || precipType === 6) {
    return { Icon: CloudRain, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/10' }
  }
  if (precipType === 3 || precipType === 7) {
    return { Icon: CloudSnow, color: 'text-sky-300', bg: 'from-sky-400/20 to-sky-500/10' }
  }
  if (sky === 1) {
    return { Icon: CloudSun, color: 'text-yellow-400', bg: 'from-amber-400/20 to-orange-400/10' }
  }
  if (sky === 3) {
    return { Icon: CloudSun, color: 'text-orange-300', bg: 'from-orange-400/20 to-amber-500/10' }
  }
  return { Icon: Cloud, color: 'text-slate-400', bg: 'from-slate-400/20 to-slate-500/10' }
}

function getMidForecastIcon(weatherText: string) {
  if (weatherText.includes('눈')) {
    return { Icon: CloudSnow, color: 'text-sky-300', bg: 'from-sky-400/20 to-sky-500/10' }
  }
  if (weatherText.includes('비')) {
    return { Icon: CloudRain, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/10' }
  }
  if (weatherText.includes('맑')) {
    return { Icon: CloudSun, color: 'text-yellow-400', bg: 'from-amber-400/20 to-orange-400/10' }
  }
  return { Icon: Cloud, color: 'text-slate-400', bg: 'from-slate-400/20 to-slate-500/10' }
}

// 풍속 체감 레벨
function getWindLabel(speed: number): string {
  if (speed < 1) return '고요'
  if (speed < 4) return '약한 바람'
  if (speed < 9) return '적당'
  if (speed < 14) return '강한 바람'
  return '매우 강함'
}

// 바람 방향 (동서/남북 풍속 기반)
function getWindDirection(ew: number, ns: number): string {
  if (ew === 0 && ns === 0) return ''
  const angle = (Math.atan2(ew, ns) * 180) / Math.PI
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
  const idx = Math.round(((angle + 360) % 360) / 45) % 8
  return dirs[idx] + '풍'
}

function toKmaDate(date: string) {
  return date.replace(/-/g, '')
}

function formatPlayDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  return `${month}/${day} (${dayNames[target.getDay()]})`
}

function getFocusHour(day: ForecastDayData, playTime?: string | null) {
  const targetHour = playTime ? parseInt(playTime.slice(0, 2), 10) : 12
  const candidates = day.hours.filter((hour) => {
    const value = parseInt(hour.time.slice(0, 2), 10)
    return value >= 7 && value <= 19
  })
  const pool = candidates.length > 0 ? candidates : day.hours

  return pool.reduce((closest, hour) => {
    const closestDiff = Math.abs(parseInt(closest.time.slice(0, 2), 10) - targetHour)
    const hourDiff = Math.abs(parseInt(hour.time.slice(0, 2), 10) - targetHour)
    return hourDiff < closestDiff ? hour : closest
  }, pool[0])
}

export function WeatherDialog({ ccName, playDate, playTime, onClose }: Props) {
  const [currentData, setCurrentData] = useState<CurrentWeatherResponse | null>(null)
  const [forecastData, setForecastData] = useState<{
    source: ForecastResponse
    day: ForecastDayData
    focusHour: ForecastHourData | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const isPast = playDate < today

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)
        setError('')
        setCurrentData(null)
        setForecastData(null)

        if (isPast) {
          const res = await fetch(`/api/weather?ccName=${encodeURIComponent(ccName)}`)
          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || '날씨 정보를 가져올 수 없습니다.')
          }
          setCurrentData(await res.json())
          return
        }

        const res = await fetch(`/api/weather/forecast?ccName=${encodeURIComponent(ccName)}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: '날씨 정보를 가져올 수 없습니다.' }))
          throw new Error(errData.error || '날씨 정보를 가져올 수 없습니다.')
        }

        const forecast = (await res.json()) as ForecastResponse
        const day = forecast.days.find((item) => item.date === toKmaDate(playDate))

        if (!day) {
          throw new Error('예약일 예보는 아직 제공되지 않습니다. 최신 단기예보 범위 내에서 다시 확인해주세요.')
        }

        setForecastData({
          source: forecast,
          day,
          focusHour: day.hours.length > 0 ? getFocusHour(day, playTime) : null,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    }
    fetchWeather()
  }, [ccName, isPast, playDate, playTime])

  const currentWeather = currentData?.weather
  const forecastDay = forecastData?.day
  const forecastHour = forecastData?.focusHour ?? null
  const currentIcon = getWeatherIcon(currentWeather?.precipType ?? 0)
  const forecastIcon = forecastHour
    ? getForecastIcon(forecastHour.sky, forecastHour.pty)
    : getMidForecastIcon(forecastDay?.weatherText ?? '')
  const maxPop = forecastDay
    ? (forecastDay.hours.length > 0 ? Math.max(...forecastDay.hours.map((hour) => hour.pop)) : forecastDay.precipProbability)
    : 0
  const forecastSummary = forecastHour
    ? (forecastHour.pty > 0 ? forecastHour.ptyText : forecastHour.skyText)
    : (forecastDay?.weatherText ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 로딩 */}
        {loading && (
          <div className="flex flex-col items-center gap-3 p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">날씨 정보를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div className="p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-muted px-4 py-2 text-sm hover:bg-muted/80"
            >
              닫기
            </button>
          </div>
        )}

        {/* 날씨 데이터 */}
        {currentData && currentWeather && !loading && (
          <>
            {/* 상단: 날씨 아이콘 + 기온 + 골프장명 */}
            <div className={`relative rounded-t-2xl bg-gradient-to-br ${currentIcon.bg} p-5`}>
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-black/10"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4">
                <currentIcon.Icon className={`h-14 w-14 ${currentIcon.color}`} />
                <div>
                  <div className="text-4xl font-bold tracking-tight">
                    {Math.round(currentWeather.temperature)}
                    <span className="text-lg font-normal text-muted-foreground">°C</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-muted-foreground">
                    {currentWeather.precipTypeText === '없음' ? '맑음' : currentWeather.precipTypeText}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{currentData.ccName} &middot; 지난 일정이라 현재 날씨로 안내합니다.</p>
                <p>{currentData.baseDate.slice(4, 6)}/{currentData.baseDate.slice(6)} {currentData.baseTime.slice(0, 2)}:00 기준</p>
              </div>
            </div>

            {/* 하단: 상세 정보 */}
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Droplets className="h-4 w-4 shrink-0 text-blue-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">습도</div>
                  <div className="text-sm font-semibold">{currentWeather.humidity}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Wind className="h-4 w-4 shrink-0 text-teal-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">바람</div>
                  <div className="text-sm font-semibold">
                    {currentWeather.windSpeed}m/s
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {getWindLabel(currentWeather.windSpeed)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <CloudRain className="h-4 w-4 shrink-0 text-indigo-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">강수량</div>
                  <div className="text-sm font-semibold">
                    {currentWeather.rainfall > 0 ? `${currentWeather.rainfall}mm` : '-'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Thermometer className="h-4 w-4 shrink-0 text-orange-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">풍향</div>
                  <div className="text-sm font-semibold">
                    {getWindDirection(currentWeather.windEW, currentWeather.windNS) || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* 골프 적합도 한줄 코멘트 */}
            <div className="rounded-b-2xl border-t border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
              {getGolfComment(currentWeather.temperature, currentWeather.windSpeed, currentWeather.precipType, currentWeather.rainfall)}
            </div>
          </>
        )}

        {forecastData && forecastDay && !loading && (
          <>
            <div className={`relative rounded-t-2xl bg-gradient-to-br ${forecastIcon.bg} p-5`}>
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-black/10"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4">
                <forecastIcon.Icon className={`h-14 w-14 ${forecastIcon.color}`} />
                <div>
                  <div className="text-4xl font-bold tracking-tight">
                    {forecastHour ? (
                      <>
                        {Math.round(forecastHour.temp)}
                        <span className="text-lg font-normal text-muted-foreground">°C</span>
                      </>
                    ) : (
                      <>
                        {Math.round(forecastDay.maxTemp)}°
                        <span className="text-lg font-normal text-muted-foreground"> / {Math.round(forecastDay.minTemp)}°</span>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-muted-foreground">
                    {forecastSummary}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{forecastData.source.ccName} &middot; {formatPlayDate(playDate)} 예약일 예보</p>
                <p>
                  {forecastHour
                    ? `${playTime ? `${playTime} 기준 인접 시간대` : `${forecastHour.time.slice(0, 2)}:00 대표 예보`}`
                    : '중기예보 일별 요약'} ·{' '}
                  발표 {forecastHour
                    ? `${forecastData.source.baseDate.slice(4, 6)}/${forecastData.source.baseDate.slice(6)} ${forecastData.source.baseTime.slice(0, 2)}:00`
                    : `${forecastData.source.midBaseDate?.slice(4, 6) ?? forecastData.source.baseDate.slice(4, 6)}/${forecastData.source.midBaseDate?.slice(6) ?? forecastData.source.baseDate.slice(6)} ${(forecastData.source.midBaseTime ?? forecastData.source.baseTime).slice(0, 2)}:00`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Thermometer className="h-4 w-4 shrink-0 text-orange-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">최저/최고</div>
                  <div className="text-sm font-semibold">
                    {Math.round(forecastDay.minTemp)}° / {Math.round(forecastDay.maxTemp)}°
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Droplets className="h-4 w-4 shrink-0 text-blue-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">{forecastHour ? '강수확률' : '대표 강수확률'}</div>
                  <div className="text-sm font-semibold">{maxPop}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Wind className="h-4 w-4 shrink-0 text-teal-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">{forecastHour ? '바람' : '예보구간'}</div>
                  {forecastHour ? (
                    <div className="text-sm font-semibold">
                      {forecastHour.windSpeed}m/s
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        {getWindLabel(forecastHour.windSpeed)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold">
                      {forecastDay.periods.map((period) => period.label).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <CloudRain className="h-4 w-4 shrink-0 text-indigo-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">{forecastHour ? '습도' : '예보'}</div>
                  <div className="text-sm font-semibold">{forecastHour ? `${forecastHour.humidity}%` : forecastDay.weatherText}</div>
                </div>
              </div>
            </div>

            <div className="rounded-b-2xl border-t border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
              {getForecastGolfComment(forecastDay, forecastHour)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function getGolfComment(temp: number, wind: number, precipType: number, rainfall: number): string {
  if (precipType > 0 && rainfall > 0) return '비/눈 소식이 있어요. 우산 챙기세요!'
  if (wind >= 10) return '바람이 많이 불어요. 클럽 선택에 유의하세요!'
  if (temp < 5) return '꽤 추워요. 방한 준비 필수!'
  if (temp > 33) return '폭염 주의! 수분 섭취 잊지 마세요.'
  if (temp >= 15 && temp <= 25 && wind < 6) return '골프 치기 딱 좋은 날씨예요!'
  return '즐거운 라운딩 되세요!'
}

function getForecastGolfComment(day: ForecastDayData, hour: ForecastHourData | null): string {
  const maxPop = day.hours.length > 0 ? Math.max(...day.hours.map((item) => item.pop)) : day.precipProbability
  if (hour && (hour.pty > 0 || maxPop >= 60)) return '예약일 비 가능성이 있습니다. 우천 대비를 권장합니다.'
  if (!hour && maxPop >= 60) return '예약일 비 가능성이 있습니다. 일정 전 최신 단기예보를 다시 확인하세요.'
  if (hour && hour.windSpeed >= 10) return '예약 시간대 바람이 강할 수 있습니다. 클럽 선택에 유의하세요.'
  if (day.minTemp < 5) return '예약일 아침 기온이 낮습니다. 방한 준비가 필요합니다.'
  if (day.maxTemp > 30) return '예약일 낮 기온이 높을 수 있습니다. 수분 보충을 준비하세요.'
  if (hour && day.minTemp >= 10 && day.maxTemp <= 25 && hour.windSpeed < 6) return '예약일 컨디션이 무난합니다. 라운딩하기 좋은 편입니다.'
  return '예약일 예보 기준으로 무난한 컨디션입니다.'
}
