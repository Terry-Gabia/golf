import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWatchRound } from '@/hooks/useWatchRound'
import { AuthScreen } from '@/components/AuthScreen'
import { StartScreen } from '@/components/StartScreen'
import { StrokeCounter } from '@/components/StrokeCounter'
import { RoundSummary } from '@/components/RoundSummary'
import type { Screen, LocalWatchRound } from '@/types'

export default function App() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const { round, recentCourses, startRound, updateStroke, goToHole, completeRound } = useWatchRound(user?.id ?? null)

  const [screen, setScreen] = useState<Screen>(() => {
    if (!user) return 'auth'
    if (round?.status === 'in_progress') return 'counter'
    return 'start'
  })

  const [completedRound, setCompletedRound] = useState<LocalWatchRound | null>(null)

  // 인증 상태 변경 감지
  if (!authLoading && !user && screen !== 'auth') {
    setScreen('auth')
  }
  if (!authLoading && user && screen === 'auth') {
    setScreen(round?.status === 'in_progress' ? 'counter' : 'start')
  }

  const handleGoogleLogin = useCallback(async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('로그인 실패:', err)
    }
  }, [signInWithGoogle])

  const handleStart = useCallback((ccName: string, holes: number) => {
    startRound(ccName, holes)
    setScreen('counter')
  }, [startRound])

  const handleComplete = useCallback(async () => {
    const result = await completeRound()
    if (result) {
      setCompletedRound(result)
      setScreen('summary')
    }
  }, [completeRound])

  const handleNewRound = useCallback(() => {
    setCompletedRound(null)
    setScreen('start')
  }, [])

  return (
    <div className="w-full h-full bg-background relative">
      {/* 로그아웃 버튼 (좌상단, 인증 후에만) */}
      {user && screen !== 'auth' && (
        <button
          onClick={signOut}
          className="absolute top-1 left-2 text-[9px] text-muted-foreground/50 z-10"
        >
          로그아웃
        </button>
      )}

      {screen === 'auth' && (
        <AuthScreen
          onGoogleLogin={handleGoogleLogin}
          loading={authLoading}
        />
      )}

      {screen === 'start' && (
        <StartScreen
          recentCourses={recentCourses}
          onStart={handleStart}
          onResume={() => setScreen('counter')}
          hasActiveRound={round?.status === 'in_progress'}
        />
      )}

      {screen === 'counter' && round && (
        <StrokeCounter
          round={round}
          onUpdateStroke={updateStroke}
          onGoToHole={goToHole}
          onComplete={handleComplete}
        />
      )}

      {screen === 'summary' && completedRound && (
        <RoundSummary
          round={completedRound}
          onNewRound={handleNewRound}
        />
      )}
    </div>
  )
}
