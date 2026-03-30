import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { GolfRound, GolfRoundPlayer, PlayType, RoundVisibility } from '@/types'

type NewRound = {
  play_type: PlayType
  visibility: RoundVisibility
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
    if (!userId) {
      setRounds([])
      setLoading(false)
      return
    }

    setLoading(true)

    const { data: ownRoundsData } = await supabase
      .from('golf_rounds')
      .select('*')
      .eq('user_id', userId)
      .order('play_date', { ascending: false })

    const { data: publicRoundsData } = await supabase
      .from('golf_rounds')
      .select('*')
      .eq('visibility', 'public')
      .neq('user_id', userId)
      .order('play_date', { ascending: false })

    const roundsData = [...(ownRoundsData ?? []), ...(publicRoundsData ?? [])]
      .filter((round, index, array) => array.findIndex((item) => item.id === round.id) === index)
      .sort((a, b) => {
        const playDateDiff = b.play_date.localeCompare(a.play_date)
        if (playDateDiff !== 0) return playDateDiff
        return b.created_at.localeCompare(a.created_at)
      })

    if (roundsData.length === 0) {
      setRounds([])
      setLoading(false)
      return
    }

    const roundIds = roundsData.map((r) => r.id)
    const { data: playersData } = await supabase
      .from('golf_round_players')
      .select('*')
      .in('round_id', roundIds.length > 0 ? roundIds : ['none'])

    const enriched: GolfRound[] = roundsData.map((round) => ({
      ...round,
      visibility: round.visibility ?? 'private',
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
        visibility: data.visibility,
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

  const updateRound = useCallback(async (id: string, data: NewRound) => {
    const { error } = await supabase
      .from('golf_rounds')
      .update({
        play_type: data.play_type,
        visibility: data.visibility,
        cc_name: data.cc_name,
        play_date: data.play_date,
        holes: data.holes,
        pars: data.pars,
      })
      .eq('id', id)

    if (error) throw error

    const { error: deletePlayersError } = await supabase
      .from('golf_round_players')
      .delete()
      .eq('round_id', id)

    if (deletePlayersError) throw deletePlayersError

    if (data.players.length > 0) {
      const { error: insertPlayersError } = await supabase
        .from('golf_round_players')
        .insert(data.players.map((player) => ({ round_id: id, ...player })))

      if (insertPlayersError) throw insertPlayersError
    }

    await fetchRounds()
  }, [fetchRounds])

  const deleteRound = useCallback(async (id: string) => {
    const { error } = await supabase.from('golf_rounds').delete().eq('id', id)
    if (error) throw error
    setRounds((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { rounds, loading, addRound, updateRound, deleteRound, refetch: fetchRounds }
}
