import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  noticeTitle: string
  onSubmit: (participantName: string) => Promise<void>
  onClose: () => void
}

export function JoinNoticeDialog({ noticeTitle, onSubmit, onClose }: Props) {
  const [participantName, setParticipantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = participantName.trim()
    if (!trimmedName) {
      setError('참가자 이름을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSubmit(trimmedName)
      onClose()
    } catch {
      setError('참가 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">참가하기</h3>
            <p className="mt-1 text-sm text-muted-foreground">{noticeTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">참가자 이름</label>
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="예: Terry"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '참가 등록 중...' : '참가 등록'}
          </button>
        </form>
      </div>
    </div>
  )
}
