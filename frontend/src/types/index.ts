export type PlayType = '필드' | '파3' | '스크린'
export type Theme = 'light' | 'dark'
export type RoundVisibility = 'public' | 'private'

export interface GolfRecord {
  id: string
  user_id: string
  play_type: PlayType
  cc_name: string
  play_date: string
  score: number | null
  memo: string | null
  created_at: string
  updated_at: string
}

export interface GolfRound {
  id: string
  user_id: string
  play_type: PlayType
  visibility: RoundVisibility
  cc_name: string
  play_date: string
  holes: number
  pars: number[]
  created_at: string
  updated_at: string
  players?: GolfRoundPlayer[]
}

export interface GolfRoundPlayer {
  id: string
  round_id: string
  player_name: string
  scores: number[]
  total: number
  created_at: string
}

export interface Notice {
  id: string
  user_id: string
  title: string
  play_type: PlayType
  cc_name: string | null
  play_date: string
  play_time: string | null
  max_members: number
  description: string | null
  created_at: string
  updated_at: string
  participants?: NoticeParticipant[]
  author_name?: string | null
  author_email?: string
}

export interface NoticeParticipant {
  id: string
  notice_id: string
  user_id: string
  created_at: string
  display_name?: string | null
  email?: string
}

export interface UserProfile {
  user_id: string
  display_name: string | null
  theme: Theme
  slack_user_id: string | null
}

export const PLAY_TYPES: PlayType[] = ['필드', '파3', '스크린']
export const ROUND_VISIBILITIES: RoundVisibility[] = ['private', 'public']
export const ROUND_VISIBILITY_LABELS: Record<RoundVisibility, string> = {
  private: '비공개',
  public: '공개',
}

export const PLAY_TYPE_COLORS: Record<PlayType, { bg: string; text: string }> = {
  '필드': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  '파3': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  '스크린': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
}

export const PLAYER_ROW_COLORS = [
  'bg-orange-300 dark:bg-orange-800/50',
  'bg-orange-200 dark:bg-orange-700/40',
  'bg-yellow-300 dark:bg-yellow-800/50',
  'bg-yellow-200 dark:bg-yellow-700/40',
  'bg-gray-300 dark:bg-gray-600/50',
  'bg-emerald-200 dark:bg-emerald-800/40',
  'bg-sky-200 dark:bg-sky-800/40',
  'bg-pink-200 dark:bg-pink-800/40',
]
