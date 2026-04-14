import { useRef, useCallback } from 'react'
import type { LocalWatchRound } from '@/types'

interface StrokeCounterProps {
  round: LocalWatchRound
  onUpdateStroke: (hole: number, delta: number) => void
  onGoToHole: (hole: number) => void
  onComplete: () => void
  onDiscard: () => void
}

export function StrokeCounter({ round, onUpdateStroke, onGoToHole, onComplete, onDiscard }: StrokeCounterProps) {
  const touchStartX = useRef(0)
  const currentHole = round.current_hole
  const currentScore = round.scores[currentHole - 1] || 0

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentHole > 1) {
        onGoToHole(currentHole - 1)
      } else if (diff < 0 && currentHole < round.holes) {
        onGoToHole(currentHole + 1)
      }
    }
  }, [currentHole, round.holes, onGoToHole])

  // 모든 홀에 타수가 입력되어야 완료 가능
  const filledHoles = round.scores.filter(s => s > 0).length
  const allFilled = filledHoles === round.holes

  return (
    <div
      className="watch-safe gap-1"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 코스명 + 종료 버튼 */}
      <div className="flex items-center justify-between w-full">
        <div className="text-[10px] text-muted-foreground truncate">
          {round.cc_name}
        </div>
        <button
          onClick={onDiscard}
          className="text-[10px] text-destructive/60 px-1"
        >
          취소
        </button>
      </div>

      {/* 홀 번호 */}
      <div className="text-sm font-medium text-primary">
        Hole {currentHole}
        <span className="text-muted-foreground"> / {round.holes}</span>
      </div>

      {/* 타수 (메인) */}
      <div className="text-[72px] font-black leading-none text-foreground my-1">
        {currentScore}
      </div>

      {/* +/- 버튼 */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onUpdateStroke(currentHole, -1)}
          disabled={currentScore <= 0}
          className="watch-btn bg-destructive text-destructive-foreground disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => onUpdateStroke(currentHole, 1)}
          className="watch-btn bg-primary text-primary-foreground"
        >
          +
        </button>
      </div>

      {/* 홀 네비게이션 */}
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={() => onGoToHole(currentHole - 1)}
          disabled={currentHole <= 1}
          className="text-lg text-muted-foreground disabled:opacity-20 px-2 py-1"
        >
          ◀
        </button>

        {/* 도트 인디케이터 */}
        <div className="flex gap-0.5 flex-wrap justify-center max-w-[120px]">
          {Array.from({ length: round.holes }, (_, i) => (
            <button
              key={i}
              onClick={() => onGoToHole(i + 1)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i + 1 === currentHole
                  ? 'bg-primary'
                  : round.scores[i] > 0
                    ? 'bg-foreground/60'
                    : 'bg-foreground/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => onGoToHole(currentHole + 1)}
          disabled={currentHole >= round.holes}
          className="text-lg text-muted-foreground disabled:opacity-20 px-2 py-1"
        >
          ▶
        </button>
      </div>

      {/* 총합 + 완료 */}
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs text-muted-foreground">
          합계 {round.total}타 ({filledHoles}/{round.holes})
        </span>
        <button
          onClick={onComplete}
          disabled={!allFilled}
          className={`px-3 py-1 rounded-full text-xs font-bold active:scale-95 transition-all ${
            allFilled
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground opacity-40'
          }`}
        >
          저장
        </button>
      </div>
    </div>
  )
}
