import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { PLAY_TYPES, ROUND_VISIBILITY_LABELS } from '@/types'
import type { GolfRound, PlayType, RoundVisibility } from '@/types'

interface PlayerInput {
  name: string
  scores: string[]
}

interface Props {
  round?: GolfRound | null
  onSubmit: (data: {
    play_type: PlayType
    visibility: RoundVisibility
    cc_name: string
    play_date: string
    holes: number
    pars: number[]
    players: { player_name: string; scores: number[]; total: number }[]
  }) => Promise<void>
  onClose: () => void
}

function buildInitialPlayers(round?: GolfRound | null): PlayerInput[] {
  if (!round?.players?.length) {
    return [{ name: '', scores: Array(round?.holes ?? 9).fill('') }]
  }

  return round.players.map((player) => ({
    name: player.player_name,
    scores: player.scores.map((score) => String(score)),
  }))
}

export function ScorecardForm({ round, onSubmit, onClose }: Props) {
  const [playType, setPlayType] = useState<PlayType>(round?.play_type ?? '파3')
  const [visibility, setVisibility] = useState<RoundVisibility>(round?.visibility ?? 'private')
  const [ccName, setCcName] = useState(round?.cc_name ?? '')
  const [playDate, setPlayDate] = useState(round?.play_date ?? new Date().toISOString().split('T')[0])
  const [holes, setHoles] = useState(round?.holes ?? 9)
  const [pars, setPars] = useState<string[]>(
    (round?.pars ?? Array(round?.holes ?? 9).fill(3)).map((par) => String(par))
  )
  const [players, setPlayers] = useState<PlayerInput[]>(buildInitialPlayers(round))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const updateHoles = (n: number) => {
    setHoles(n)
    setPars((prev) => {
      const next = Array(n).fill('3')
      prev.forEach((v, i) => { if (i < n) next[i] = v })
      return next
    })
    setPlayers((prev) =>
      prev.map((p) => {
        const next = Array(n).fill('')
        p.scores.forEach((v, i) => { if (i < n) next[i] = v })
        return { ...p, scores: next }
      })
    )
  }

  const addPlayer = () => {
    setPlayers((prev) => [...prev, { name: '', scores: Array(holes).fill('') }])
  }

  const removePlayer = (idx: number) => {
    setPlayers((prev) => prev.filter((_, i) => i !== idx))
  }

  const updatePlayerName = (idx: number, name: string) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, name } : p)))
  }

  const updatePlayerScore = (pIdx: number, hIdx: number, val: string) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== pIdx) return p
        const scores = [...p.scores]
        scores[hIdx] = val
        return { ...p, scores }
      })
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ccName.trim()) return
    const validPlayers = players.filter((p) => p.name.trim())
    if (validPlayers.length === 0) { setError('참가자를 1명 이상 입력해주세요.'); return }

    setLoading(true)
    setError('')
    try {
      await onSubmit({
        play_type: playType,
        visibility,
        cc_name: ccName.trim(),
        play_date: playDate,
        holes,
        pars: pars.map((p) => parseInt(p) || 3),
        players: validPlayers.map((p) => {
          const scores = p.scores.map((s) => (s === '' ? 0 : parseInt(s) || 0))
          return {
            player_name: p.name.trim(),
            scores,
            total: scores.reduce((a, b) => a + b, 0),
          }
        }),
      })
      onClose()
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl bg-card border border-border p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{round ? '스코어카드 수정' : '새 스코어카드'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본정보 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">종류</label>
              <select
                value={playType}
                onChange={(e) => setPlayType(e.target.value as PlayType)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {PLAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">골프장</label>
              <input
                type="text"
                value={ccName}
                onChange={(e) => setCcName(e.target.value)}
                required
                placeholder="분당 그린피아"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">날짜</label>
              <input
                type="date"
                value={playDate}
                onChange={(e) => setPlayDate(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">홀 수</label>
              <select
                value={holes}
                onChange={(e) => updateHoles(parseInt(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={9}>9홀</option>
                <option value={18}>18홀</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">공개 설정</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['private', 'public'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    visibility === option
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="block font-medium">{ROUND_VISIBILITY_LABELS[option]}</span>
                  <span className="mt-1 block text-xs opacity-80">
                    {option === 'public'
                      ? '로그인한 누구나 보고 수정할 수 있습니다.'
                      : '작성자 본인만 보고 수정할 수 있습니다.'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 파 설정 + 스코어 입력 테이블 */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="sticky left-0 z-10 bg-muted/80 px-2 py-2 text-left font-medium min-w-[80px]">홀</th>
                  {Array.from({ length: holes }, (_, i) => (
                    <th key={i} className="px-1 py-2 text-center font-bold text-red-700 dark:text-red-400 min-w-[40px]">
                      {i + 1}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-bold min-w-[48px]">합계</th>
                  <th className="w-8" />
                </tr>
                <tr className="border-b border-border">
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium">파</td>
                  {pars.map((p, i) => (
                    <td key={i} className="px-0.5 py-1">
                      <input
                        type="number"
                        value={p}
                        onChange={(e) => {
                          const next = [...pars]
                          next[i] = e.target.value
                          setPars(next)
                        }}
                        min={3}
                        max={5}
                        className="w-full rounded border border-input bg-background px-1 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center font-bold">
                    {pars.reduce((a, b) => a + (parseInt(b) || 0), 0)}
                  </td>
                  <td />
                </tr>
              </thead>
              <tbody>
                {players.map((player, pIdx) => {
                  const total = player.scores.reduce((a, b) => a + (parseInt(b) || 0), 0)
                  return (
                    <tr key={pIdx} className="border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-card px-1 py-1">
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => updatePlayerName(pIdx, e.target.value)}
                          placeholder={`참가자 ${pIdx + 1}`}
                          className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      {player.scores.map((s, hIdx) => (
                        <td key={hIdx} className="px-0.5 py-1">
                          <input
                            type="number"
                            value={s}
                            onChange={(e) => updatePlayerScore(pIdx, hIdx, e.target.value)}
                            placeholder="0"
                            className="w-full rounded border border-input bg-background px-1 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-center font-bold">{total}</td>
                      <td className="px-1">
                        {players.length > 1 && (
                          <button type="button" onClick={() => removePlayer(pIdx)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addPlayer}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <Plus className="h-4 w-4" /> 참가자 추가
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : round ? '수정' : '저장'}
          </button>
        </form>
      </div>
    </div>
  )
}
