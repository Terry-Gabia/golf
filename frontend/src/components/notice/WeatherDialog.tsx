import { useEffect, useState } from 'react'
import { X, Thermometer, Droplets, Wind, CloudRain, CloudSnow, CloudSun } from 'lucide-react'

interface WeatherResponse {
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

interface Props {
  ccName: string
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

export function WeatherDialog({ ccName, onClose }: Props) {
  const [data, setData] = useState<WeatherResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        const res = await fetch(`/api/weather?ccName=${encodeURIComponent(ccName)}`)
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || '날씨 정보를 가져올 수 없습니다.')
        }
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    }
    fetchWeather()
  }, [ccName])

  const w = data?.weather
  const { Icon: WeatherIcon, color: iconColor, bg: gradBg } = getWeatherIcon(w?.precipType ?? 0)

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
        {data && w && !loading && (
          <>
            {/* 상단: 날씨 아이콘 + 기온 + 골프장명 */}
            <div className={`relative rounded-t-2xl bg-gradient-to-br ${gradBg} p-5`}>
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-black/10"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4">
                <WeatherIcon className={`h-14 w-14 ${iconColor}`} />
                <div>
                  <div className="text-4xl font-bold tracking-tight">
                    {Math.round(w.temperature)}
                    <span className="text-lg font-normal text-muted-foreground">°C</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-muted-foreground">
                    {w.precipTypeText === '없음' ? '맑음' : w.precipTypeText}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {data.ccName} &middot; {data.baseDate.slice(4, 6)}/{data.baseDate.slice(6)}
                {' '}{data.baseTime.slice(0, 2)}:00 기준
              </p>
            </div>

            {/* 하단: 상세 정보 */}
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Droplets className="h-4 w-4 shrink-0 text-blue-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">습도</div>
                  <div className="text-sm font-semibold">{w.humidity}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Wind className="h-4 w-4 shrink-0 text-teal-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">바람</div>
                  <div className="text-sm font-semibold">
                    {w.windSpeed}m/s
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {getWindLabel(w.windSpeed)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <CloudRain className="h-4 w-4 shrink-0 text-indigo-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">강수량</div>
                  <div className="text-sm font-semibold">
                    {w.rainfall > 0 ? `${w.rainfall}mm` : '-'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-card p-3.5">
                <Thermometer className="h-4 w-4 shrink-0 text-orange-400" />
                <div>
                  <div className="text-[11px] text-muted-foreground">풍향</div>
                  <div className="text-sm font-semibold">
                    {getWindDirection(w.windEW, w.windNS) || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* 골프 적합도 한줄 코멘트 */}
            <div className="rounded-b-2xl border-t border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
              {getGolfComment(w.temperature, w.windSpeed, w.precipType, w.rainfall)}
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
