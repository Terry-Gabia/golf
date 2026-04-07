import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GalleryComment, GalleryItem, GalleryMediaType, GalleryVisibility } from '@/types'
import { parseYouTubeLink } from '@/utils/youtube'

const GALLERY_BUCKET = 'gallery-media'

type UploadFilePayload = {
  file: File
  title?: string | null
  description?: string | null
  visibility: GalleryVisibility
}

type UploadYoutubePayload = {
  youtubeUrl: string
  title?: string | null
  description?: string | null
  visibility: GalleryVisibility
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

async function resolveGalleryMediaUrl(item: GalleryItem) {
  if ((item.source_type ?? 'upload') !== 'upload' || item.bucket_name !== GALLERY_BUCKET) {
    return item.public_url
  }

  const { data, error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .createSignedUrl(item.file_path, 60 * 60)

  if (error) throw error
  return data.signedUrl
}

async function resolveGalleryMediaUrls(items: GalleryItem[]) {
  const uploadItems = items.filter(
    (item) => (item.source_type ?? 'upload') === 'upload' && item.bucket_name === GALLERY_BUCKET
  )

  if (uploadItems.length === 0) {
    return new Map<string, string>()
  }

  const { data, error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .createSignedUrls(uploadItems.map((item) => item.file_path), 60 * 60)

  if (error) throw error

  return new Map(
    uploadItems.map((item, index) => [item.id, data[index]?.signedUrl ?? item.public_url])
  )
}

export function useGallery(userId: string | null, userEmail: string | null) {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCommentCountMap = useCallback(async () => {
    const { data, error } = await supabase
      .from('gallery_comments')
      .select('gallery_item_id')

    if (error) throw error

    return (data ?? []).reduce((accumulator, comment) => {
      accumulator.set(comment.gallery_item_id, (accumulator.get(comment.gallery_item_id) ?? 0) + 1)
      return accumulator
    }, new Map<string, number>())
  }, [])

  const fetchGallery = useCallback(async () => {
    if (!userId) return

    try {
      const [{ data, error }, commentCountMap] = await Promise.all([
        supabase
          .from('gallery_items')
          .select('*')
          .order('created_at', { ascending: false }),
        fetchCommentCountMap(),
      ])

      if (error) throw error

      const galleryItems = (data ?? []) as GalleryItem[]
      const signedUrlMap = await resolveGalleryMediaUrls(galleryItems)

      const resolvedItems = galleryItems.map((item) => ({
        ...item,
        public_url: signedUrlMap.get(item.id) ?? resolveGalleryMediaUrl(item),
        visibility: (item.visibility ?? 'public') as GalleryVisibility,
        comment_count: commentCountMap.get(item.id) ?? 0,
      }))

      const normalizedItems = await Promise.all(
        resolvedItems.map(async (item) => ({
          ...item,
          public_url: typeof item.public_url === 'string' ? item.public_url : await item.public_url,
        }))
      )

      setItems(normalizedItems)
    } finally {
      setLoading(false)
    }
  }, [fetchCommentCountMap, userId])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_comments' }, () => {
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
          visibility: payload.visibility,
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

      const insertPayload = {
        user_id: userId,
        uploader_name: getUploaderName(userEmail),
        title: title?.trim() || getDefaultTitle(file),
        description: description?.trim() || null,
        media_type: mediaType,
        visibility: payload.visibility,
        source_type: 'upload' as const,
        bucket_name: GALLERY_BUCKET,
        file_path: filePath,
        public_url: `storage://${GALLERY_BUCKET}/${filePath}`,
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

  const incrementView = useCallback(async (itemId: string) => {
    const { error } = await supabase.rpc('increment_gallery_item_view', {
      target_item_id: itemId,
    })
    if (error) throw error

    setItems((prev) => prev.map((item) => (
      item.id === itemId
        ? { ...item, view_count: (item.view_count ?? 0) + 1 }
        : item
    )))
  }, [])

  const fetchComments = useCallback(async (galleryItemId: string) => {
    const { data, error } = await supabase
      .from('gallery_comments')
      .select('*')
      .eq('gallery_item_id', galleryItemId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as GalleryComment[]
  }, [])

  const addComment = useCallback(async (galleryItemId: string, content: string) => {
    if (!userId) return

    const { error } = await supabase
      .from('gallery_comments')
      .insert({
        gallery_item_id: galleryItemId,
        user_id: userId,
        commenter_name: getUploaderName(userEmail),
        content: content.trim(),
      })

    if (error) throw error

    setItems((prev) => prev.map((item) => (
      item.id === galleryItemId
        ? { ...item, comment_count: (item.comment_count ?? 0) + 1 }
        : item
    )))
  }, [userEmail, userId])

  const deleteComment = useCallback(async (galleryItemId: string, commentId: string) => {
    const { error } = await supabase
      .from('gallery_comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error

    setItems((prev) => prev.map((item) => (
      item.id === galleryItemId
        ? { ...item, comment_count: Math.max(0, (item.comment_count ?? 0) - 1) }
        : item
    )))
  }, [])

  return {
    items,
    loading,
    uploadItem,
    deleteItem,
    fetchComments,
    addComment,
    deleteComment,
    incrementView,
    refetch: fetchGallery,
  }
}
