import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { PLAY_TYPES } from '@/types'
import type { GolfRecord, PlayType } from '@/types'

interface Props {
  record?: GolfRecord | null
  onSubmit: (data: {
    play_type: PlayType
    cc_name: string
    play_date: string
    score: number | null
    memo: string | null
  }) => Promise<void>
  onClose: () => void
}

export function GolfRecordForm({ record, onSubmit, onClose }: Props) {
  const [playType, setPlayType] = useState<PlayType>(record?.play_type ?? '필드')
  const [ccName, setCcName] = useState(record?.cc_name ?? '')
  const [playDate, setPlayDate] = useState(record?.play_date ?? new Date().toISOString().split('T')[0])
  const [score, setScore] = useState(record?.score?.toString() ?? '')
  const [memo, setMemo] = useState(record?.memo ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ccName.trim()) return
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        play_type: playType,
        cc_name: ccName.trim(),
        play_date: playDate,
        score: score ? parseInt(score) : null,
        memo: memo.trim() || null,
      })
      onClose()
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{record ? '기록 수정' : '새 기록'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">종류</label>
            <div className="flex gap-2">
              {PLAY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPlayType(type)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    playType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">골프장/장소명</label>
            <input
              type="text"
              value={ccName}
              onChange={(e) => setCcName(e.target.value)}
              required
              placeholder="예: 남서울CC, 골프존 강남점"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">날짜</label>
              <input
                type="date"
                value={playDate}
                onChange={(e) => setPlayDate(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">스코어 (선택)</label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="예: 85"
                min={30}
                max={200}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">메모 (선택)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항, 날씨, 동반자 등"
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : record ? '수정' : '추가'}
          </button>
        </form>
      </div>
    </div>
  )
}
