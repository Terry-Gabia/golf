import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Header } from '@/components/layout/Header'
import { AuthForm } from '@/components/auth/AuthForm'

const ScorecardsTab = lazy(() => import('@/components/tabs/ScorecardsTab'))
const NoticesTab = lazy(() => import('@/components/tabs/NoticesTab'))
const WeatherTab = lazy(() => import('@/components/tabs/WeatherTab'))
const GalleryTab = lazy(() => import('@/components/tabs/GalleryTab'))

type TabKey = 'scorecards' | 'notices' | 'weather' | 'gallery'

export default function App() {
  const { user, loading: authLoading, signUp, signIn, signInWithGoogle, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme(user?.id ?? null)
  const [activeTab, setActiveTab] = useState<TabKey>('scorecards')
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(() => new Set(['scorecards']))

  useEffect(() => {
    setLoadedTabs((current) => {
      if (current.has(activeTab)) return current

      const next = new Set(current)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const loadingFallback = (
    <div className="py-20 text-center text-muted-foreground">불러오는 중...</div>
  )

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
        onTabChange={(tab) => setActiveTab(tab as TabKey)}
      />
      <main className="mx-auto max-w-4xl px-4 py-6">
        {loadedTabs.has('scorecards') && (
          <section className={activeTab === 'scorecards' ? 'block' : 'hidden'}>
            <Suspense fallback={loadingFallback}>
              <ScorecardsTab currentUserId={user.id} />
            </Suspense>
          </section>
        )}
        {loadedTabs.has('notices') && (
          <section className={activeTab === 'notices' ? 'block' : 'hidden'}>
            <Suspense fallback={loadingFallback}>
              <NoticesTab currentUserId={user.id} />
            </Suspense>
          </section>
        )}
        {loadedTabs.has('weather') && (
          <section className={activeTab === 'weather' ? 'block' : 'hidden'}>
            <Suspense fallback={loadingFallback}>
              <WeatherTab />
            </Suspense>
          </section>
        )}
        {loadedTabs.has('gallery') && (
          <section className={activeTab === 'gallery' ? 'block' : 'hidden'}>
            <Suspense fallback={loadingFallback}>
              <GalleryTab currentUserId={user.id} userEmail={user.email ?? null} />
            </Suspense>
          </section>
        )}
      </main>
    </div>
  )
}
