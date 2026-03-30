import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Theme } from '@/types'

export function useTheme(userId: string | null) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('user_profiles')
      .select('theme')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.theme) {
          setThemeState(data.theme as Theme)
          localStorage.setItem('theme', data.theme)
        }
      })
  }, [userId])

  const setTheme = useCallback(
    async (newTheme: Theme) => {
      setThemeState(newTheme)
      localStorage.setItem('theme', newTheme)
      if (userId) {
        await supabase
          .from('user_profiles')
          .upsert({ user_id: userId, theme: newTheme }, { onConflict: 'user_id' })
      }
    },
    [userId]
  )

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme }
}
