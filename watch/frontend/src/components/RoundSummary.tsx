import type { LocalWatchRound } from '@/types'

interface RoundSummaryProps {
  round: LocalWatchRound
  onNewRound: () => void
}

export function RoundSummary({ round, onNewRound }: RoundSummaryProps) {
  return (
    <div className="watch-safe gap-2 overflow-y-auto">
      {/* 헤더 */}
      <div className="text-center">
        <div className="text-xs text-muted-foreground">{round.cc_name}</div>
        <div className="text-[10px] text-muted-foreground">{round.play_date}</div>
      </div>

      {/* 홀별 스코어 그리드 */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs w-full">
        {round.scores.map((score, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground">{i + 1}H</span>
            <span className="font-bold text-foreground">{score}</span>
          </div>
        ))}
      </div>

      {/* 구분선 + 총합 */}
      <div className="w-full border-t border-border my-1" />
      <div className="text-center">
        <span className="text-lg font-black text-primary">{round.total}</span>
        <span className="text-xs text-muted-foreground ml-1">타</span>
      </div>

      {/* 동기화 상태 */}
      <div className="text-[10px] text-muted-foreground">
        {round.synced ? '서버 저장 완료' : '오프라인 저장됨'}
      </div>

      {/* 새 라운드 */}
      <button
        onClick={onNewRound}
        className="mt-1 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition-transform"
      >
        새 라운드
      </button>
    </div>
  )
}
