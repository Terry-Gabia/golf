import { Pencil, Trash2 } from 'lucide-react'
import { PLAY_TYPE_COLORS, PLAYER_ROW_COLORS, ROUND_VISIBILITY_LABELS } from '@/types'
import type { GolfRound } from '@/types'

interface Props {
  round: GolfRound
  currentUserId: string
  onEdit: (round: GolfRound) => void
  onDelete: (id: string) => void
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = DAY_NAMES[d.getDay()]
  return `${y}년 ${m}월 ${day}일 (${dow})`
}

function scoreCell(score: number) {
  if (score < 0) return { text: String(score), cls: 'text-blue-600 dark:text-blue-400 font-bold' }
  if (score === 0) return { text: '0', cls: 'text-muted-foreground' }
  if (score >= 3) return { text: String(score), cls: 'text-red-600 dark:text-red-400 font-bold' }
  return { text: String(score), cls: 'font-medium' }
}

function totalClass(total: number) {
  if (total <= 0) return 'text-blue-600 dark:text-blue-400 font-bold'
  if (total >= 15) return 'text-red-600 dark:text-red-400 font-bold'
  return 'font-bold'
}

export function Scorecard({ round, currentUserId, onEdit, onDelete }: Props) {
  const players = round.players ?? []
  const pars = round.pars ?? []
  const parTotal = pars.reduce((a, b) => a + b, 0)
  const colors = PLAY_TYPE_COLORS[round.play_type]
  const isOwner = round.user_id === currentUserId
  const canEdit = isOwner || round.visibility === 'public'

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
            {round.play_type}
          </span>
          <span className="inline-flex rounded-md bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {ROUND_VISIBILITY_LABELS[round.visibility]}
          </span>
          <span className="font-semibold">{round.cc_name}</span>
          <span className="text-sm text-muted-foreground">— {formatDate(round.play_date)}</span>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={() => onEdit(round)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => onDelete(round.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 스코어카드 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2 text-left font-medium min-w-[80px]">홀</th>
              {pars.map((_, i) => (
                <th key={i} className="px-3 py-2 text-center font-bold text-red-700 dark:text-red-400 min-w-[44px]">
                  {i + 1}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-bold text-red-700 dark:text-red-400 min-w-[52px]">합계</th>
            </tr>
            <tr className="border-b border-border">
              <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium">파</td>
              {pars.map((p, i) => (
                <td key={i} className="px-3 py-1.5 text-center">{p}</td>
              ))}
              <td className="px-3 py-1.5 text-center font-bold">{parTotal}</td>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={pars.length + 2} className="px-3 py-4 text-center text-muted-foreground">
                  참가자 없음
                </td>
              </tr>
            ) : (
              players.map((player, idx) => {
                const rowColor = PLAYER_ROW_COLORS[idx % PLAYER_ROW_COLORS.length]
                return (
                  <tr key={player.id} className={`border-b border-border/50 ${rowColor}`}>
                    <td className={`sticky left-0 z-10 ${rowColor} px-3 py-2 font-semibold`}>
                      {player.player_name}
                    </td>
                    {(player.scores ?? []).map((s, i) => {
                      const { text, cls } = scoreCell(s)
                      return (
                        <td key={i} className={`px-3 py-2 text-center ${cls}`}>{text}</td>
                      )
                    })}
                    <td className={`px-3 py-2 text-center ${totalClass(player.total)}`}>
                      {player.total}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
