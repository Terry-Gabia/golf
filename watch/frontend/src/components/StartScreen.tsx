import { useState } from 'react'

interface StartScreenProps {
  recentCourses: string[]
  onStart: (ccName: string, holes: number) => void
  onResume: () => void
  hasActiveRound: boolean
}

export function StartScreen({ recentCourses, onStart, onResume, hasActiveRound }: StartScreenProps) {
  const [ccName, setCcName] = useState('')
  const [holes, setHoles] = useState(18)
  const [showInput, setShowInput] = useState(recentCourses.length === 0)

  const handleStart = (name: string) => {
    if (!name.trim()) return
    onStart(name.trim(), holes)
  }

  if (hasActiveRound) {
    return (
      <div className="watch-safe text-center gap-3">
        <div className="text-sm text-muted-foreground">진행 중인 라운드</div>
        <button
          onClick={onResume}
          className="px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
        >
          이어하기
        </button>
      </div>
    )
  }

  return (
    <div className="watch-safe text-center gap-2 overflow-y-auto">
      <div className="text-sm font-bold text-primary mb-1">라운드 시작</div>

      {/* 홀 수 선택 */}
      <div className="flex gap-2 mb-2">
        {[9, 18].map(h => (
          <button
            key={h}
            onClick={() => setHoles(h)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              holes === h
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground border border-border'
            }`}
          >
            {h}홀
          </button>
        ))}
      </div>

      {/* 최근 코스 목록 */}
      {!showInput && recentCourses.length > 0 && (
        <div className="flex flex-col gap-1.5 w-full">
          {recentCourses.map(name => (
            <button
              key={name}
              onClick={() => handleStart(name)}
              className="w-full px-3 py-2 rounded-lg bg-card text-foreground text-xs text-left border border-border active:scale-95 transition-transform truncate"
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => setShowInput(true)}
            className="w-full px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs active:scale-95 transition-transform"
          >
            + 직접 입력
          </button>
        </div>
      )}

      {/* 직접 입력 */}
      {showInput && (
        <div className="flex flex-col gap-2 w-full">
          <input
            type="text"
            value={ccName}
            onChange={e => setCcName(e.target.value)}
            placeholder="골프장 이름"
            className="w-full px-3 py-2 rounded-lg bg-card text-foreground text-xs border border-border outline-none focus:border-primary placeholder:text-muted-foreground"
            autoFocus
          />
          <div className="flex gap-2">
            {recentCourses.length > 0 && (
              <button
                onClick={() => setShowInput(false)}
                className="flex-1 px-3 py-2 rounded-full bg-card text-muted-foreground text-xs border border-border active:scale-95 transition-transform"
              >
                취소
              </button>
            )}
            <button
              onClick={() => handleStart(ccName)}
              disabled={!ccName.trim()}
              className="flex-1 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform"
            >
              시작
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
