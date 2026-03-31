import { LogOut } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import type { Theme } from '@/types'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User | null
  theme: Theme
  onToggleTheme: () => void
  onSignOut: () => void
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Header({ user, theme, onToggleTheme, onSignOut, activeTab, onTabChange }: Props) {
  const tabs = [
    { id: 'scorecards', label: '스코어카드' },
    { id: 'notices', label: '일정 공지' },
    { id: 'weather', label: '날씨' },
    { id: 'gallery', label: '갤러리' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
          <h1 className="truncate text-lg font-bold text-primary sm:text-xl">⛳ 피터파의 샷점검</h1>
          {user && (
            <nav className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {user && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:block">
                {user.email}
              </span>
              <button
                onClick={onSignOut}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="로그아웃"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
