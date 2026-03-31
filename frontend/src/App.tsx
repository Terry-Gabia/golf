import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useGolfRounds } from '@/hooks/useGolfRounds'
import { useNotices } from '@/hooks/useNotices'
import { Header } from '@/components/layout/Header'
import { AuthForm } from '@/components/auth/AuthForm'
import { ScorecardList } from '@/components/golf/ScorecardList'
import { NoticeList } from '@/components/notice/NoticeList'
import { WeatherTab } from '@/components/weather/WeatherTab'

export default function App() {
  const { user, loading: authLoading, signUp, signIn, signInWithGoogle, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme(user?.id ?? null)
  const { rounds, loading: roundsLoading, addRound, updateRound, deleteRound } = useGolfRounds(user?.id ?? null)
  const { notices, loading: noticesLoading, addNotice, updateNotice, deleteNotice, joinNotice, leaveNotice } = useNotices(user?.id ?? null)
  const [activeTab, setActiveTab] = useState('scorecards')

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <div className="fixed right-4 top-4 z-50">
          <button onClick={toggleTheme} className="rounded-lg p-2 hover:bg-muted transition-colors">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <AuthForm onSignIn={signIn} onSignUp={signUp} onSignInWithGoogle={signInWithGoogle} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={signOut}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="mx-auto max-w-4xl px-4 py-6">
        {activeTab === 'scorecards' && (
          <ScorecardList
            currentUserId={user.id}
            rounds={rounds}
            loading={roundsLoading}
            onAdd={addRound}
            onUpdate={updateRound}
            onDelete={deleteRound}
          />
        )}
        {activeTab === 'notices' && (
          <NoticeList
            notices={notices}
            loading={noticesLoading}
            currentUserId={user.id}
            onAdd={addNotice}
            onUpdate={updateNotice}
            onDelete={deleteNotice}
            onJoin={joinNotice}
            onLeave={leaveNotice}
          />
        )}
        {activeTab === 'weather' && <WeatherTab />}
      </main>
    </div>
  )
}
