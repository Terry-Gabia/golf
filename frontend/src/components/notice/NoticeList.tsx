import { useState } from 'react'
import { Plus } from 'lucide-react'
import { NoticeCard } from './NoticeCard'
import { NoticeForm } from './NoticeForm'
import { JoinNoticeDialog } from './JoinNoticeDialog'
import type { Notice, PlayType } from '@/types'

interface Props {
  notices: Notice[]
  loading: boolean
  currentUserId: string
  onAdd: (data: {
    title: string
    play_type: PlayType
    cc_name: string | null
    play_date: string
    play_time: string | null
    max_members: number
    description: string | null
  }) => Promise<void>
  onUpdate: (id: string, data: Partial<{
    title: string
    play_type: PlayType
    cc_name: string | null
    play_date: string
    play_time: string | null
    max_members: number
    description: string | null
  }>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onJoin: (id: string, participantName: string) => Promise<void>
  onLeave: (id: string) => Promise<void>
}

export function NoticeList({ notices, loading, currentUserId, onAdd, onUpdate, onDelete, onJoin, onLeave }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editNotice, setEditNotice] = useState<Notice | null>(null)
  const [joinNotice, setJoinNotice] = useState<Notice | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const upcoming = notices.filter((n) => n.play_date >= today)
  const past = notices.filter((n) => n.play_date < today)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">일정 공지</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          새 공지
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">불러오는 중...</div>
      ) : notices.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          등록된 일정이 없습니다. 새 일정을 등록해보세요!
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">다가오는 일정</h3>
              {upcoming.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  currentUserId={currentUserId}
                  onEdit={(n) => setEditNotice(n)}
                  onDelete={onDelete}
                  onJoin={() => setJoinNotice(notice)}
                  onLeave={onLeave}
                />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">지난 일정</h3>
              {past.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  currentUserId={currentUserId}
                  onEdit={(n) => setEditNotice(n)}
                  onDelete={onDelete}
                  onJoin={() => setJoinNotice(notice)}
                  onLeave={onLeave}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <NoticeForm onSubmit={onAdd} onClose={() => setShowForm(false)} />
      )}

      {editNotice && (
        <NoticeForm
          notice={editNotice}
          onSubmit={async (data) => {
            await onUpdate(editNotice.id, data)
          }}
          onClose={() => setEditNotice(null)}
        />
      )}

      {joinNotice && (
        <JoinNoticeDialog
          noticeTitle={joinNotice.title}
          onSubmit={(participantName) => onJoin(joinNotice.id, participantName)}
          onClose={() => setJoinNotice(null)}
        />
      )}
    </div>
  )
}
