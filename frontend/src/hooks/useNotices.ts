import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Notice, PlayType } from '@/types'

type NewNotice = {
  title: string
  play_type: PlayType
  cc_name: string | null
  play_date: string
  play_time: string | null
  max_members: number
  description: string | null
}

export function useNotices(userId: string | null) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotices = useCallback(async () => {
    if (!userId) return

    const { data: noticesData, error } = await supabase
      .from('notices')
      .select('*')
      .order('play_date', { ascending: true })

    if (error || !noticesData) {
      setLoading(false)
      return
    }

    const noticeIds = noticesData.map((n) => n.id)
    const { data: participants } = await supabase
      .from('notice_participants')
      .select('*')
      .in('notice_id', noticeIds)

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, display_name')

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) ?? [])

    const enriched: Notice[] = noticesData.map((notice) => ({
      ...notice,
      participants: (participants ?? [])
        .filter((p) => p.notice_id === notice.id)
        .map((p) => ({ ...p, display_name: profileMap.get(p.user_id) ?? null })),
      author_name: profileMap.get(notice.user_id) ?? null,
    }))

    setNotices(enriched)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotices()
  }, [fetchNotices])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notices-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        fetchNotices()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_participants' }, () => {
        fetchNotices()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchNotices])

  const addNotice = useCallback(
    async (notice: NewNotice) => {
      if (!userId) return
      const { error } = await supabase.from('notices').insert({ user_id: userId, ...notice })
      if (error) throw error
      await fetchNotices()
    },
    [userId, fetchNotices]
  )

  const updateNotice = useCallback(
    async (id: string, updates: Partial<NewNotice>) => {
      const { error } = await supabase.from('notices').update(updates).eq('id', id)
      if (error) throw error
      await fetchNotices()
    },
    [fetchNotices]
  )

  const deleteNotice = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('notices').delete().eq('id', id)
      if (error) throw error
      setNotices((prev) => prev.filter((n) => n.id !== id))
    },
    []
  )

  const joinNotice = useCallback(
    async (noticeId: string) => {
      if (!userId) return
      const { error } = await supabase
        .from('notice_participants')
        .insert({ notice_id: noticeId, user_id: userId })
      if (error) throw error
      await fetchNotices()
    },
    [userId, fetchNotices]
  )

  const leaveNotice = useCallback(
    async (noticeId: string) => {
      if (!userId) return
      const { error } = await supabase
        .from('notice_participants')
        .delete()
        .eq('notice_id', noticeId)
        .eq('user_id', userId)
      if (error) throw error
      await fetchNotices()
    },
    [userId, fetchNotices]
  )

  return { notices, loading, addNotice, updateNotice, deleteNotice, joinNotice, leaveNotice, refetch: fetchNotices }
}
