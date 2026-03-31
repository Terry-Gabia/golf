import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GalleryItem, GalleryMediaType } from '@/types'

const GALLERY_BUCKET = 'gallery-media'

type UploadPayload = {
  file: File
  title?: string | null
  description?: string | null
}

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
    async ({ file, title, description }: UploadPayload) => {
      if (!userId) return

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

      const payload = {
        user_id: userId,
        uploader_name: getUploaderName(userEmail),
        title: title?.trim() || getDefaultTitle(file),
        description: description?.trim() || null,
        media_type: mediaType,
        bucket_name: GALLERY_BUCKET,
        file_path: filePath,
        public_url: publicUrlData.publicUrl,
      }

      const { error: insertError } = await supabase.from('gallery_items').insert(payload)

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

      const { error: storageError } = await supabase.storage.from(item.bucket_name).remove([item.file_path])
      if (storageError) throw storageError

      setItems((prev) => prev.filter((current) => current.id !== item.id))
    },
    []
  )

  return { items, loading, uploadItem, deleteItem, refetch: fetchGallery }
}
