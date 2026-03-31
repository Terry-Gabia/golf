import { CalendarDays, Trash2, User, Video, X } from 'lucide-react'
import type { GalleryItem } from '@/types'

interface Props {
  item: GalleryItem
  canDelete: boolean
  onDelete: (item: GalleryItem) => Promise<void>
  onClose: () => void
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function GalleryViewerDialog({ item, canDelete, onDelete, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-6">
        <div
          className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl lg:grid-cols-[1.35fr,0.65fr]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex min-h-[320px] items-center justify-center bg-black/70 p-4">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white/80 hover:bg-black/70 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {item.media_type === 'video' ? (
              <video
                src={item.public_url}
                controls
                playsInline
                className="max-h-[75vh] w-full rounded-2xl object-contain"
              />
            ) : (
              <img
                src={item.public_url}
                alt={item.title ?? 'gallery item'}
                className="max-h-[75vh] w-full rounded-2xl object-contain"
              />
            )}
          </div>

          <div className="flex flex-col justify-between p-6">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {item.media_type === 'video' ? <Video className="h-3.5 w-3.5" /> : null}
                  {item.media_type === 'video' ? '동영상' : '사진'}
                </span>
              </div>

              <h3 className="text-2xl font-semibold leading-tight">
                {item.title || '제목 없음'}
              </h3>

              {item.description && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              )}

              <div className="mt-6 space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{item.uploader_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
            </div>

            {canDelete && (
              <div className="mt-6">
                <button
                  onClick={() => onDelete(item)}
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
