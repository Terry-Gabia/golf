import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { GolfRound, GolfRoundPlayer, PlayType } from '@/types'

type NewRound = {
  play_type: PlayType
  cc_name: string
  play_date: string
  holes: number
  pars: number[]
  players: { player_name: string; scores: number[]; total: number }[]
}

export function useGolfRounds(userId: string | null) {
  const [rounds, setRounds] = useState<GolfRound[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRounds = useCallback(async () => {
    if (!userId) return
    const { data: roundsData } = await supabase
      .from('golf_rounds')
      .select('*')
      .eq('user_id', userId)
      .order('play_date', { ascending: false })

    if (!roundsData) { setLoading(false); return }

    const roundIds = roundsData.map((r) => r.id)
    const { data: playersData } = await supabase
      .from('golf_round_players')
      .select('*')
      .in('round_id', roundIds.length > 0 ? roundIds : ['none'])

    const enriched: GolfRound[] = roundsData.map((round) => ({
      ...round,
      pars: round.pars as number[],
      players: ((playersData ?? []) as GolfRoundPlayer[])
        .filter((p) => p.round_id === round.id)
        .map((p) => ({ ...p, scores: p.scores as number[] })),
    }))

    setRounds(enriched)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchRounds() }, [fetchRounds])

  const addRound = useCallback(async (data: NewRound) => {
    if (!userId) return
    const { data: round, error } = await supabase
      .from('golf_rounds')
      .insert({
        user_id: userId,
        play_type: data.play_type,
        cc_name: data.cc_name,
        play_date: data.play_date,
        holes: data.holes,
        pars: data.pars,
      })
      .select()
      .single()

    if (error || !round) throw error

    if (data.players.length > 0) {
      const { error: pError } = await supabase
        .from('golf_round_players')
        .insert(data.players.map((p) => ({ round_id: round.id, ...p })))
      if (pError) throw pError
    }

    await fetchRounds()
  }, [userId, fetchRounds])

  const deleteRound = useCallback(async (id: string) => {
    const { error } = await supabase.from('golf_rounds').delete().eq('id', id)
    if (error) throw error
    setRounds((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { rounds, loading, addRound, deleteRound, refetch: fetchRounds }
}
