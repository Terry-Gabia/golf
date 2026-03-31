import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GalleryItem, GalleryMediaType } from '@/types'
import { parseYouTubeLink } from '@/utils/youtube'

const GALLERY_BUCKET = 'gallery-media'

type UploadFilePayload = {
  file: File
  title?: string | null
  description?: string | null
}

type UploadYoutubePayload = {
  youtubeUrl: string
  title?: string | null
  description?: string | null
}

type UploadPayload = UploadFilePayload | UploadYoutubePayload

function getMediaType(file: File): GalleryMediaType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  throw new Error('이미지 또는 동영상 파일만 업로드할 수 있습니다.')
}

function sanitizeFileName(name: string) {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9가-힣._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function getDefaultTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, '')
}

function getUploaderName(email?: string | null) {
  if (!email) return 'member'
  return email.split('@')[0] || 'member'
}

function isYoutubePayload(payload: UploadPayload): payload is UploadYoutubePayload {
  return 'youtubeUrl' in payload
}

export function useGallery(userId: string | null, userEmail: string | null) {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGallery = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('gallery_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setLoading(false)
      throw error
    }

    setItems(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchGallery().catch(() => {
      setLoading(false)
    })
  }, [fetchGallery])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('gallery-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_items' }, () => {
        fetchGallery().catch(() => undefined)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchGallery])

  const uploadItem = useCallback(
    async (payload: UploadPayload) => {
      if (!userId) return

      if (isYoutubePayload(payload)) {
        const parsed = parseYouTubeLink(payload.youtubeUrl)
        if (!parsed) {
          throw new Error('지원하지 않는 유튜브 링크입니다. Shorts, watch, youtu.be 링크를 사용해주세요.')
        }

        const itemPayload = {
          user_id: userId,
          uploader_name: getUploaderName(userEmail),
          title: payload.title?.trim() || 'YouTube 영상',
          description: payload.description?.trim() || null,
          media_type: 'video' as const,
          source_type: 'youtube' as const,
          bucket_name: 'external',
          file_path: `youtube:${parsed.videoId}`,
          public_url: parsed.thumbnailUrl,
          external_url: parsed.externalUrl,
          embed_url: parsed.embedUrl,
          thumbnail_url: parsed.thumbnailUrl,
        }

        const { error: insertError } = await supabase.from('gallery_items').insert(itemPayload)
        if (insertError) throw insertError

        await fetchGallery()
        return
      }

      const { file, title, description } = payload
      const mediaType = getMediaType(file)
      const fileName = sanitizeFileName(file.name)
      const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from(GALLERY_BUCKET)
        .getPublicUrl(filePath)

      const insertPayload = {
        user_id: userId,
        uploader_name: getUploaderName(userEmail),
        title: title?.trim() || getDefaultTitle(file),
        description: description?.trim() || null,
        media_type: mediaType,
        source_type: 'upload' as const,
        bucket_name: GALLERY_BUCKET,
        file_path: filePath,
        public_url: publicUrlData.publicUrl,
      }

      const { error: insertError } = await supabase.from('gallery_items').insert(insertPayload)

      if (insertError) {
        await supabase.storage.from(GALLERY_BUCKET).remove([filePath])
        throw insertError
      }

      await fetchGallery()
    },
    [fetchGallery, userEmail, userId]
  )

  const deleteItem = useCallback(
    async (item: GalleryItem) => {
      const { error: deleteError } = await supabase.from('gallery_items').delete().eq('id', item.id)
      if (deleteError) throw deleteError

      if ((item.source_type ?? 'upload') === 'upload' && item.bucket_name === GALLERY_BUCKET) {
        const { error: storageError } = await supabase.storage.from(item.bucket_name).remove([item.file_path])
        if (storageError) throw storageError
      }

      setItems((prev) => prev.filter((current) => current.id !== item.id))
    },
    []
  )

  return { items, loading, uploadItem, deleteItem, refetch: fetchGallery }
}
