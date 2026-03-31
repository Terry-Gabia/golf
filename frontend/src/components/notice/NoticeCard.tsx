import { useState } from 'react'
import { Calendar, Clock, MapPin, Users, Pencil, Trash2, CloudSun } from 'lucide-react'
import { PLAY_TYPE_COLORS } from '@/types'
import type { Notice } from '@/types'
import { WeatherDialog } from './WeatherDialog'

interface Props {
  notice: Notice
  currentUserId: string
  onEdit: (notice: Notice) => void
  onDelete: (id: string) => void
  onJoin: () => void
  onLeave: (id: string) => void
}

export function NoticeCard({ notice, currentUserId, onEdit, onDelete, onJoin, onLeave }: Props) {
  const colors = PLAY_TYPE_COLORS[notice.play_type]
  const isAuthor = notice.user_id === currentUserId
  const participants = notice.participants ?? []
  const isJoined = participants.some((p) => p.user_id === currentUserId)
  const isFull = participants.length >= notice.max_members
  const isPast = new Date(notice.play_date) < new Date(new Date().toISOString().split('T')[0])
  const [showWeather, setShowWeather] = useState(false)

  return (
    <div className={`rounded-xl border border-border bg-card p-4 transition-colors ${isPast ? 'opacity-60' : 'hover:border-primary/30'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {notice.play_type}
            </span>
            <span className="font-semibold">{notice.title}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {notice.play_date}
            </span>
            {notice.play_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {notice.play_time}
              </span>
            )}
            {notice.cc_name && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowWeather(true)
                }}
                className="flex items-center gap-1 rounded-md px-1 -mx-1 hover:bg-primary/10 hover:text-primary transition-colors"
                title="날씨 보기"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="underline decoration-dotted underline-offset-2">{notice.cc_name}</span>
                <CloudSun className="h-3 w-3 opacity-50" />
              </button>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {participants.length}/{notice.max_members}명
            </span>
          </div>

          {notice.description && (
            <p className="mt-2 text-sm text-muted-foreground">{notice.description}</p>
          )}

          {participants.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {p.participant_name || p.display_name || p.email || '참가자'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="ml-2 flex flex-col items-end gap-2">
          {isAuthor && (
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(notice)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(notice.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          {!isPast && (
            <button
              onClick={() => (isJoined ? onLeave(notice.id) : onJoin())}
              disabled={!isJoined && isFull}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isJoined
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : isFull
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {isJoined ? '참가 취소' : isFull ? '마감' : '참가'}
            </button>
          )}
        </div>
      </div>
      {showWeather && notice.cc_name && (
        <WeatherDialog ccName={notice.cc_name} onClose={() => setShowWeather(false)} />
      )}
    </div>
  )
}
