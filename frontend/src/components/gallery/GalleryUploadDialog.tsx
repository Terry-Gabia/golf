import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Link2, UploadCloud, Video, X } from 'lucide-react'
import { parseYouTubeLink } from '@/utils/youtube'

interface Props {
  onSubmit: (data:
    | {
        file: File
        title: string | null
        description: string | null
      }
    | {
        youtubeUrl: string
        title: string | null
        description: string | null
      }
  ) => Promise<void>
  onClose: () => void
}

function getDefaultTitle(file: File | null) {
  if (!file) return ''
  return file.name.replace(/\.[^.]+$/, '')
}

export function GalleryUploadDialog({ onSubmit, onClose }: Props) {
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    if (mode === 'upload' && file && !title.trim()) {
      setTitle(getDefaultTitle(file))
    }
  }, [file, mode, title])

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  const parsedYoutube = useMemo(() => parseYouTubeLink(youtubeUrl), [youtubeUrl])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const isVideo = file?.type.startsWith('video/') ?? false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'upload') {
      if (!file) {
        setError('사진 또는 동영상을 선택해주세요.')
        return
      }

      setLoading(true)
      setError('')

      try {
        await onSubmit({
          file,
          title: title.trim() || null,
          description: description.trim() || null,
        })
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!parsedYoutube) {
      setError('유효한 유튜브 또는 쇼츠 링크를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onSubmit({
        youtubeUrl: youtubeUrl.trim(),
        title: title.trim() || null,
        description: description.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '링크 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">갤러리 업로드</h3>
            <p className="mt-1 text-sm text-muted-foreground">사진이나 동영상을 올려서 라운딩 기록을 모아두세요.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setMode('upload')
                setError('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'upload' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              파일 업로드
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('youtube')
                setError('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'youtube' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              YouTube 링크
            </button>
          </div>

          {mode === 'upload' ? (
            <label className="block cursor-pointer rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/8 via-background to-emerald-500/10 p-5 transition-colors hover:border-primary/50">
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null
                  setFile(nextFile)
                  setError('')
                }}
              />

              {previewUrl ? (
                <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
                  <div className="overflow-hidden rounded-2xl border border-border bg-black/20">
                    {isVideo ? (
                      <video src={previewUrl} controls className="aspect-[16/11] w-full object-cover" />
                    ) : (
                      <img src={previewUrl} alt="preview" className="aspect-[16/11] w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-white/8 bg-background/80 p-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {isVideo ? <Video className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                        {isVideo ? '동영상' : '사진'}
                      </div>
                      <p className="truncate text-sm font-medium">{file?.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ''}
                      </p>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      파일을 다시 선택하면 현재 미리보기가 교체됩니다.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="font-medium">사진 또는 동영상 선택</div>
                    <p className="mt-1 text-sm text-muted-foreground">JPG, PNG, WEBP, GIF, MP4, MOV, WEBM 지원</p>
                  </div>
                </div>
              )}
            </label>
          ) : (
            <div className="space-y-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-red-500/8 via-background to-primary/10 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">유튜브 / 쇼츠 링크</label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value)
                      setError('')
                    }}
                    placeholder="https://www.youtube.com/shorts/..."
                    className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  `youtube.com/watch`, `youtube.com/shorts`, `youtu.be` 링크를 지원합니다.
                </p>
              </div>

              {parsedYoutube ? (
                <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
                  <div className="overflow-hidden rounded-2xl border border-border bg-black/20">
                    <img src={parsedYoutube.thumbnailUrl} alt="youtube thumbnail" className="aspect-[16/11] w-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-between rounded-2xl border border-white/8 bg-background/80 p-4">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500">
                        <Video className="h-3.5 w-3.5" />
                        YouTube
                      </div>
                      <p className="text-sm font-medium">유튜브 링크가 정상적으로 인식되었습니다.</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{parsedYoutube.externalUrl}</p>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      저장하면 갤러리에서 썸네일과 함께 카드로 보이고, 클릭 시 플레이어가 열립니다.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  링크를 넣으면 유튜브 썸네일과 플레이어 미리보기 정보가 준비됩니다.
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
            <div>
              <label className="mb-1 block text-sm font-medium">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 그린피아 파3 1조"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">설명</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 3번홀 버디 순간"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
