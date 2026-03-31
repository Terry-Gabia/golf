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
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-primary">⛳ 피터파의 샷점검</h1>
          {user && (
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
        <div className="flex items-center gap-2">
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
