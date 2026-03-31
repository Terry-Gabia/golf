import { useEffect, useState } from 'react'
import { CalendarDays, Eye, MessageCircle, Send, Trash2, User, Video, X } from 'lucide-react'
import type { GalleryComment, GalleryItem } from '@/types'

interface Props {
  item: GalleryItem
  currentUserId: string
  canDelete: boolean
  onDelete: (item: GalleryItem) => Promise<void>
  onFetchComments: (galleryItemId: string) => Promise<GalleryComment[]>
  onAddComment: (galleryItemId: string, content: string) => Promise<void>
  onDeleteComment: (galleryItemId: string, commentId: string) => Promise<void>
  onView: (itemId: string) => Promise<void>
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

export function GalleryViewerDialog({
  item,
  currentUserId,
  canDelete,
  onDelete,
  onFetchComments,
  onAddComment,
  onDeleteComment,
  onView,
  onClose,
}: Props) {
  const isYoutube = item.source_type === 'youtube' && item.embed_url
  const [comments, setComments] = useState<GalleryComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentSaving, setCommentSaving] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [viewTracked, setViewTracked] = useState(false)

  useEffect(() => {
    setComments([])
    setCommentText('')
    setCommentError('')
    setLoadingComments(true)
    setViewTracked(false)

    onFetchComments(item.id)
      .then((data) => setComments(data))
      .catch((error) => {
        setCommentError(error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.')
      })
      .finally(() => setLoadingComments(false))
  }, [item.id, onFetchComments])

  useEffect(() => {
    if (viewTracked) return

    onView(item.id)
      .then(() => setViewTracked(true))
      .catch(() => undefined)
  }, [item.id, onView, viewTracked])

  const handleAddComment = async () => {
    const trimmed = commentText.trim()
    if (!trimmed) return

    try {
      setCommentSaving(true)
      setCommentError('')
      await onAddComment(item.id, trimmed)
      const latestComments = await onFetchComments(item.id)
      setComments(latestComments)
      setCommentText('')
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : '댓글 저장에 실패했습니다.')
    } finally {
      setCommentSaving(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      setCommentError('')
      await onDeleteComment(item.id, commentId)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : '댓글 삭제에 실패했습니다.')
    }
  }

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
            {isYoutube ? (
              <div className="aspect-[9/16] w-full max-w-md overflow-hidden rounded-2xl">
                <iframe
                  src={item.embed_url ?? undefined}
                  title={item.title ?? 'youtube video'}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : item.media_type === 'video' ? (
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
                  {isYoutube ? 'YouTube' : item.media_type === 'video' ? '동영상' : '사진'}
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>{(item.view_count ?? 0) + (viewTracked ? 1 : 0)}회</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span>{comments.length}개</span>
                </div>
                {isYoutube && item.external_url && (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm text-primary hover:underline"
                  >
                    원본 YouTube 열기
                  </a>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">댓글</h4>
                  <span className="text-xs text-muted-foreground">{comments.length}개</span>
                </div>

                <div className="mb-4 flex items-start gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="댓글을 남겨보세요"
                    rows={3}
                    className="min-h-[84px] flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={commentSaving || !commentText.trim()}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    등록
                  </button>
                </div>

                {commentError && (
                  <div className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {commentError}
                  </div>
                )}

                {loadingComments ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">댓글을 불러오는 중...</div>
                ) : comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => {
                      const isCommentOwner = comment.user_id === currentUserId
                      return (
                        <div key={comment.id} className="rounded-xl border border-border bg-background px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">{comment.commenter_name}</div>
                              <div className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(comment.created_at)}</div>
                            </div>
                            {isCommentOwner && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{comment.content}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">첫 댓글을 남겨보세요.</div>
                )}
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
