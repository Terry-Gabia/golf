import { Moon, Sun } from 'lucide-react'
import type { Theme } from '@/types'

interface Props {
  theme: Theme
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className="rounded-lg p-2 hover:bg-muted transition-colors"
      aria-label="테마 전환"
    >
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  )
}
