import { useState, useCallback } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  const increment = useCallback(() => {
    setCount(c => c + 1)
  }, [])

  const decrement = useCallback(() => {
    setCount(c => Math.max(0, c - 1))
  }, [])

  const reset = useCallback(() => {
    if (count > 0 && confirm('초기화할까요?')) {
      setCount(0)
    }
  }, [count])

  return (
    <div className="w-full h-full bg-background relative">
      <div className="watch-safe gap-2">
        {/* 타이틀 */}
        <div className="text-[11px] text-primary font-bold tracking-wide">
          타수 카운터
        </div>

        {/* 카운트 숫자 (메인) */}
        <button
          onClick={increment}
          className="text-[80px] font-black leading-none text-foreground my-2 active:scale-95 transition-transform select-none"
        >
          {count}
        </button>

        {/* +/- 버튼 */}
        <div className="flex items-center gap-6">
          <button
            onClick={decrement}
            disabled={count <= 0}
            className="watch-btn bg-destructive text-destructive-foreground disabled:opacity-30"
          >
            −
          </button>
          <button
            onClick={increment}
            className="watch-btn bg-primary text-primary-foreground"
          >
            +
          </button>
        </div>

        {/* 초기화 */}
        <button
          onClick={reset}
          className="mt-2 px-4 py-1.5 rounded-full text-[11px] text-muted-foreground border border-border active:scale-95 transition-transform"
        >
          초기화
        </button>
      </div>
    </div>
  )
}
