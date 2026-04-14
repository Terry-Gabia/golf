export interface WatchRound {
  id: string
  user_id: string
  cc_name: string
  play_date: string
  holes: number
  scores: number[]
  total: number
  status: 'in_progress' | 'completed'
  current_hole: number
  created_at: string
  updated_at: string
}

export interface LocalWatchRound extends WatchRound {
  local_id: string
  synced: boolean
  supabase_id?: string
}

export type Screen = 'auth' | 'start' | 'counter' | 'summary'
