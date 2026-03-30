import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { PLAY_TYPES } from '@/types'
import type { Notice, PlayType } from '@/types'

interface Props {
  notice?: Notice | null
  onSubmit: (data: {
    title: string
    play_type: PlayType
    cc_name: string | null
    play_date: string
    play_time: string | null
    max_members: number
    description: string | null
  }) => Promise<void>
  onClose: () => void
}

export function NoticeForm({ notice, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(notice?.title ?? '')
  const [playType, setPlayType] = useState<PlayType>(notice?.play_type ?? '필드')
  const [ccName, setCcName] = useState(notice?.cc_name ?? '')
  const [playDate, setPlayDate] = useState(notice?.play_date ?? new Date().toISOString().split('T')[0])
  const [playTime, setPlayTime] = useState(notice?.play_time ?? '')
  const [maxMembers, setMaxMembers] = useState(notice?.max_members?.toString() ?? '4')
  const [description, setDescription] = useState(notice?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        title: title.trim(),
        play_type: playType,
        cc_name: ccName.trim() || null,
        play_date: playDate,
        play_time: playTime || null,
        max_members: parseInt(maxMembers) || 4,
        description: description.trim() || null,
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
      <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{notice ? '공지 수정' : '새 일정 공지'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="예: 토요일 필드 나가실 분!"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

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
            <label className="mb-1 block text-sm font-medium">골프장 (선택)</label>
            <input
              type="text"
              value={ccName}
              onChange={(e) => setCcName(e.target.value)}
              placeholder="예: 남서울CC"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              <label className="mb-1 block text-sm font-medium">시간 (선택)</label>
              <input
                type="time"
                value={playTime}
                onChange={(e) => setPlayTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">최대인원</label>
              <input
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                min={2}
                max={20}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="추가 안내사항"
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
            {loading ? '저장 중...' : notice ? '수정' : '등록'}
          </button>
        </form>
      </div>
    </div>
  )
}
