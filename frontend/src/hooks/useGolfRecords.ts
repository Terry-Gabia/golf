import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { GolfRecord, PlayType } from '@/types'

type NewRecord = {
  play_type: PlayType
  cc_name: string
  play_date: string
  score: number | null
  memo: string | null
}

export function useGolfRecords(userId: string | null) {
  const [records, setRecords] = useState<GolfRecord[]>([])
  const [loading, setLoading] = useState(true)
  const optimisticIds = useRef<Set<string>>(new Set())

  const fetchRecords = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('golf_records')
      .select('*')
      .eq('user_id', userId)
      .order('play_date', { ascending: false })

    if (!error && data) {
      setRecords(data)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('golf-records-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'golf_records', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as GolfRecord
            if (optimisticIds.current.has(newRecord.id)) {
              optimisticIds.current.delete(newRecord.id)
              return
            }
            setRecords((prev) => [newRecord, ...prev].sort((a, b) => b.play_date.localeCompare(a.play_date)))
          } else if (payload.eventType === 'UPDATE') {
            setRecords((prev) => prev.map((r) => (r.id === payload.new.id ? (payload.new as GolfRecord) : r)))
          } else if (payload.eventType === 'DELETE') {
            setRecords((prev) => prev.filter((r) => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const addRecord = useCallback(
    async (record: NewRecord) => {
      if (!userId) return
      const tempId = crypto.randomUUID()
      const optimistic: GolfRecord = {
        id: tempId,
        user_id: userId,
        ...record,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setRecords((prev) => [optimistic, ...prev].sort((a, b) => b.play_date.localeCompare(a.play_date)))

      const { data, error } = await supabase
        .from('golf_records')
        .insert({ user_id: userId, ...record })
        .select()
        .single()

      if (error) {
        setRecords((prev) => prev.filter((r) => r.id !== tempId))
        throw error
      }
      if (data) {
        optimisticIds.current.add(data.id)
        setRecords((prev) => prev.map((r) => (r.id === tempId ? data : r)))
      }
    },
    [userId]
  )

  const updateRecord = useCallback(async (id: string, updates: Partial<NewRecord>) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))

    const { error } = await supabase.from('golf_records').update(updates).eq('id', id)
    if (error) {
      await fetchRecords()
      throw error
    }
  }, [fetchRecords])

  const deleteRecord = useCallback(async (id: string) => {
    const backup = records.find((r) => r.id === id)
    setRecords((prev) => prev.filter((r) => r.id !== id))

    const { error } = await supabase.from('golf_records').delete().eq('id', id)
    if (error) {
      if (backup) setRecords((prev) => [...prev, backup].sort((a, b) => b.play_date.localeCompare(a.play_date)))
      throw error
    }
  }, [records])

  return { records, loading, addRecord, updateRecord, deleteRecord, refetch: fetchRecords }
}
