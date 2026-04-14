import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { LocalWatchRound } from '@/types'

const CURRENT_KEY = 'golf_watch_current'
const HISTORY_KEY = 'golf_watch_history'
const COURSES_KEY = 'golf_watch_courses'

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function useWatchRound(userId: string | null) {
  const [round, setRound] = useState<LocalWatchRound | null>(() =>
    loadLocal<LocalWatchRound | null>(CURRENT_KEY, null)
  )
  const [recentCourses, setRecentCourses] = useState<string[]>(() =>
    loadLocal<string[]>(COURSES_KEY, [])
  )

  // localStorage 동기화
  useEffect(() => {
    if (round) {
      saveLocal(CURRENT_KEY, round)
    } else {
      localStorage.removeItem(CURRENT_KEY)
    }
  }, [round])

  const startRound = useCallback((ccName: string, holes: number) => {
    const newRound: LocalWatchRound = {
      local_id: crypto.randomUUID(),
      id: '',
      user_id: userId ?? '',
      cc_name: ccName,
      play_date: new Date().toISOString().split('T')[0],
      holes,
      scores: new Array(holes).fill(0),
      total: 0,
      status: 'in_progress',
      current_hole: 1,
      synced: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setRound(newRound)

    // 최근 코스 업데이트
    setRecentCourses(prev => {
      const filtered = prev.filter(c => c !== ccName)
      const updated = [ccName, ...filtered].slice(0, 5)
      saveLocal(COURSES_KEY, updated)
      return updated
    })
  }, [userId])

  const updateStroke = useCallback((hole: number, delta: number) => {
    setRound(prev => {
      if (!prev) return prev
      const scores = [...prev.scores]
      scores[hole - 1] = Math.max(0, (scores[hole - 1] || 0) + delta)
      const total = scores.reduce((a, b) => a + b, 0)
      return { ...prev, scores, total, synced: false, updated_at: new Date().toISOString() }
    })

    // 햅틱 피드백
    if ('vibrate' in navigator) {
      navigator.vibrate(30)
    }
  }, [])

  const goToHole = useCallback((hole: number) => {
    setRound(prev => {
      if (!prev) return prev
      const clamped = Math.max(1, Math.min(hole, prev.holes))
      return { ...prev, current_hole: clamped }
    })
  }, [])

  const completeRound = useCallback(async () => {
    if (!round) return null

    const completed: LocalWatchRound = {
      ...round,
      status: 'completed',
      current_hole: round.holes,
    }

    // Supabase 저장
    try {
      if (userId) {
        const { data } = await supabase.from('golf_watch_rounds').insert({
          user_id: userId,
          cc_name: round.cc_name,
          play_date: round.play_date,
          holes: round.holes,
          scores: round.scores,
          total: round.scores.reduce((a, b) => a + b, 0),
          status: 'completed',
          current_hole: round.holes,
        }).select().single()

        completed.synced = true
        completed.supabase_id = data?.id
      }
    } catch (err) {
      console.error('Supabase 저장 실패:', err)
      completed.synced = false
    }

    // 히스토리에 추가
    const history = loadLocal<LocalWatchRound[]>(HISTORY_KEY, [])
    saveLocal(HISTORY_KEY, [completed, ...history].slice(0, 50))

    // 현재 라운드 클리어
    setRound(null)

    return completed
  }, [round, userId])

  const discardRound = useCallback(() => {
    setRound(null)
  }, [])

  return {
    round,
    recentCourses,
    startRound,
    updateStroke,
    goToHole,
    completeRound,
    discardRound,
  }
}
