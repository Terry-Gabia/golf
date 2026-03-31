import { useMemo, useState } from 'react'
import { CalendarDays, Camera, Film, Images, Plus, Trash2, User } from 'lucide-react'
import { GalleryUploadDialog } from './GalleryUploadDialog'
import { GalleryViewerDialog } from './GalleryViewerDialog'
import type { GalleryItem } from '@/types'

interface Props {
  items: GalleryItem[]
  loading: boolean
  currentUserId: string
  onUpload: (data: { file: File; title: string | null; description: string | null }) => Promise<void>
  onDelete: (item: GalleryItem) => Promise<void>
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function GalleryTab({ items, loading, currentUserId, onUpload, onDelete }: Props) {
  const [showUpload, setShowUpload] = useState(false)
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null)

  const featured = items[0] ?? null
  const restItems = featured ? items.slice(1) : []
  const imageCount = useMemo(() => items.filter((item) => item.media_type === 'image').length, [items])
  const videoCount = useMemo(() => items.filter((item) => item.media_type === 'video').length, [items])

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-sky-500/10">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.15fr,0.85fr] lg:p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/10 dark:bg-white/5">
              <Images className="h-3.5 w-3.5" />
              Gallery
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">라운딩 사진과 영상을 모아두는 공간</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              필드, 파3, 스크린 기록과 함께 현장 분위기도 남길 수 있게 구성했습니다.
              사진은 크게, 동영상은 썸네일처럼 정리되고 클릭하면 바로 크게 볼 수 있습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</div>
              <div className="mt-2 text-3xl font-semibold">{items.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Camera className="h-3.5 w-3.5" />
                Photos
              </div>
              <div className="mt-2 text-3xl font-semibold">{imageCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Film className="h-3.5 w-3.5" />
                Videos
              </div>
              <div className="mt-2 text-3xl font-semibold">{videoCount}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">갤러리</h3>
          <p className="mt-1 text-sm text-muted-foreground">사진과 동영상을 업로드해서 팀 기록처럼 모아두세요.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          업로드
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">갤러리를 불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Images className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-xl font-semibold">첫 갤러리 업로드를 만들어보세요</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            사진 한 장, 짧은 스윙 영상 하나만 올려도 갤러리가 바로 시작됩니다.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            첫 업로드
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {featured && (
            <button
              type="button"
              onClick={() => setSelectedItem(featured)}
              className="group grid w-full overflow-hidden rounded-3xl border border-border bg-card text-left shadow-sm transition-transform hover:-translate-y-0.5 lg:grid-cols-[1.15fr,0.85fr]"
            >
              <div className="relative min-h-[280px] overflow-hidden bg-black">
                {featured.media_type === 'video' ? (
                  <video src={featured.public_url} muted playsInline className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <img src={featured.public_url} alt={featured.title ?? 'featured gallery'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <div className="absolute left-4 top-4 inline-flex rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  {featured.media_type === 'video' ? 'Featured Video' : 'Featured Photo'}
                </div>
              </div>

              <div className="flex flex-col justify-between p-5 lg:p-6">
                <div>
                  <div className="mb-3 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    최신 업로드
                  </div>
                  <h3 className="text-2xl font-semibold leading-tight">
                    {featured.title || '제목 없음'}
                  </h3>
                  {featured.description && (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {featured.description}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {featured.uploader_name}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(featured.created_at)}
                  </span>
                </div>
              </div>
            </button>
          )}

          {restItems.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {restItems.map((item) => {
                const isOwner = item.user_id === currentUserId
                return (
                  <div
                    key={item.id}
                    className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-black">
                        {item.media_type === 'video' ? (
                          <video src={item.public_url} muted playsInline className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                        ) : (
                          <img src={item.public_url} alt={item.title ?? 'gallery item'} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                        <div className="absolute left-3 top-3 inline-flex rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                          {item.media_type === 'video' ? '동영상' : '사진'}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h4 className="line-clamp-2 text-base font-semibold text-white">
                            {item.title || '제목 없음'}
                          </h4>
                          <div className="mt-2 flex items-center justify-between text-xs text-white/80">
                            <span>{item.uploader_name}</span>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {item.description && (
                      <p className="line-clamp-2 px-4 pb-2 pt-3 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}

                    {isOwner && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => onDelete(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showUpload && (
        <GalleryUploadDialog onSubmit={onUpload} onClose={() => setShowUpload(false)} />
      )}

      {selectedItem && (
        <GalleryViewerDialog
          item={selectedItem}
          canDelete={selectedItem.user_id === currentUserId}
          onDelete={async (item) => {
            await onDelete(item)
            setSelectedItem(null)
          }}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
