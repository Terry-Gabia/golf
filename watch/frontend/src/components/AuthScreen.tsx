interface AuthScreenProps {
  onGoogleLogin: () => void
  loading: boolean
}

export function AuthScreen({ onGoogleLogin, loading }: AuthScreenProps) {
  return (
    <div className="watch-safe text-center gap-4">
      <div className="text-lg font-bold text-primary">피터파</div>
      <div className="text-sm text-muted-foreground">워치카운터</div>

      <button
        onClick={onGoogleLogin}
        disabled={loading}
        className="mt-4 px-4 py-3 rounded-full bg-card text-foreground text-sm font-medium border border-border active:scale-95 transition-transform"
      >
        {loading ? '로그인 중...' : 'Google 로그인'}
      </button>
    </div>
  )
}
