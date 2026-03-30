export type PlayType = '필드' | '파3' | '스크린'
export type Theme = 'light' | 'dark'

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

export const PLAY_TYPE_COLORS: Record<PlayType, { bg: string; text: string }> = {
  '필드': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  '파3': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  '스크린': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
}
