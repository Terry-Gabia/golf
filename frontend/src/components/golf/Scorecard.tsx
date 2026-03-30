import { Globe2, Lock, Pencil, Sparkles, Trash2, Trophy, Users2 } from 'lucide-react'
import { PLAY_TYPE_COLORS, PLAYER_ROW_COLORS, ROUND_VISIBILITY_LABELS } from '@/types'
import type { GolfRound, GolfRoundPlayer } from '@/types'

interface Props {
  round: GolfRound
  currentUserId: string
  onEdit: (round: GolfRound) => void
  onDelete: (id: string) => void
}

type RankedPlayer = GolfRoundPlayer & { originalIndex: number; rank: number }

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

function rankLabel(rank: number) {
  return `${rank}위`
}

function trophyTone(rank: number) {
  if (rank === 1) return 'text-amber-500 dark:text-amber-300'
  if (rank === 2) return 'text-slate-500 dark:text-slate-300'
  if (rank === 3) return 'text-orange-500 dark:text-orange-300'
  return 'text-muted-foreground'
}

const PUBLIC_ROW_STYLES = [
  {
    row: 'bg-sky-50/80 dark:bg-sky-500/7',
    name: 'bg-sky-100 text-sky-950 dark:bg-sky-500/16 dark:text-sky-100',
  },
  {
    row: 'bg-amber-50/85 dark:bg-amber-500/8',
    name: 'bg-amber-100 text-amber-950 dark:bg-amber-500/16 dark:text-amber-100',
  },
  {
    row: 'bg-emerald-50/80 dark:bg-emerald-500/7',
    name: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-500/16 dark:text-emerald-100',
  },
  {
    row: 'bg-rose-50/80 dark:bg-rose-500/7',
    name: 'bg-rose-100 text-rose-950 dark:bg-rose-500/16 dark:text-rose-100',
  },
  {
    row: 'bg-violet-50/80 dark:bg-violet-500/7',
    name: 'bg-violet-100 text-violet-950 dark:bg-violet-500/16 dark:text-violet-100',
  },
]

export function Scorecard({ round, currentUserId, onEdit, onDelete }: Props) {
  const players = round.players ?? []
  const sortedPlayers: RankedPlayer[] = [...players]
    .map((player, index) => ({ ...player, originalIndex: index }))
    .sort((a, b) => {
      if (a.total !== b.total) return a.total - b.total
      return a.originalIndex - b.originalIndex
    })
    .reduce<RankedPlayer[]>((acc, player, index) => {
      const prev = acc[acc.length - 1]
      const rank = prev && prev.total === player.total ? prev.rank : index + 1
      acc.push({ ...player, rank })
      return acc
    }, [])
  const pars = round.pars ?? []
  const parTotal = pars.reduce((a, b) => a + b, 0)
  const colors = PLAY_TYPE_COLORS[round.play_type]
  const isPublic = round.visibility === 'public'
  const isOwner = round.user_id === currentUserId
  const canEdit = isOwner || isPublic

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${
      isPublic
        ? 'border-sky-400/30 bg-gradient-to-br from-sky-500/8 via-card to-emerald-500/10 shadow-[0_24px_60px_-28px_rgba(14,165,233,0.45)]'
        : 'border-border bg-card'
    }`}>
      {isPublic && (
        <>
          <div className="pointer-events-none absolute -right-12 top-0 h-28 w-28 rounded-full bg-sky-400/18 blur-3xl" />
          <div className="pointer-events-none absolute left-1/3 top-2 h-16 w-16 rounded-full bg-emerald-400/14 blur-2xl" />
        </>
      )}

      {/* 헤더 */}
      <div className={`relative flex items-start justify-between gap-4 border-b px-4 py-4 ${
        isPublic ? 'border-sky-400/20 bg-black/10 backdrop-blur-sm' : 'border-border bg-muted/50'
      }`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}>
              {round.play_type}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPublic
                ? 'bg-sky-500/12 text-sky-700 ring-1 ring-sky-400/20 dark:bg-sky-500/14 dark:text-sky-200'
                : 'bg-background text-muted-foreground'
            }`}>
              {isPublic ? <Globe2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {ROUND_VISIBILITY_LABELS[round.visibility]}
            </span>
            {isPublic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-400/20 dark:bg-emerald-500/14 dark:text-emerald-200">
                <Users2 className="h-3.5 w-3.5" />
                {players.length}명 참여
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate text-xl font-semibold">{round.cc_name}</span>
            <span className="text-sm text-muted-foreground">{formatDate(round.play_date)}</span>
          </div>

          {isPublic && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-sky-800 shadow-sm ring-1 ring-sky-200/70 dark:bg-white/6 dark:text-sky-100 dark:ring-white/10">
              <Sparkles className="h-3.5 w-3.5" />
              로그인한 누구나 보고 수정할 수 있는 공유 스코어카드
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {isPublic && (
            <div className="hidden rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-right backdrop-blur sm:block dark:bg-white/5">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Par Total</div>
              <div className="text-lg font-semibold">{parTotal}</div>
            </div>
          )}
          <div className="flex items-center gap-1">
            {canEdit && (
              <button
                onClick={() => onEdit(round)}
                className={`rounded-lg p-1.5 transition-colors ${
                  isPublic
                    ? 'text-sky-700 hover:bg-sky-500/12 hover:text-sky-800 dark:text-sky-200 dark:hover:bg-sky-500/18 dark:hover:text-white'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
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
      </div>

      {/* 스코어카드 테이블 */}
      <div className={`overflow-x-auto ${isPublic ? 'px-3 pb-3 pt-2' : ''}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${isPublic ? 'border-white/8 bg-black/10 dark:bg-white/[0.03]' : 'border-border bg-muted/30'}`}>
              <th className={`sticky left-0 z-10 px-3 py-2 text-left font-medium min-w-[80px] ${
                isPublic ? 'bg-black/20 backdrop-blur dark:bg-white/[0.05]' : 'bg-muted/80'
              }`}>홀</th>
              {pars.map((_, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 text-center font-bold min-w-[44px] ${
                    isPublic ? 'text-sky-700 dark:text-sky-300' : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {i + 1}
                </th>
              ))}
              <th className={`px-3 py-2 text-center font-bold min-w-[52px] ${
                isPublic ? 'text-sky-700 dark:text-sky-300' : 'text-red-700 dark:text-red-400'
              }`}>합계</th>
            </tr>
            <tr className={`border-b ${isPublic ? 'border-white/8' : 'border-border'}`}>
              <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium ${
                isPublic ? 'bg-background/95 backdrop-blur dark:bg-background/80' : 'bg-card'
              }`}>파</td>
              {pars.map((p, i) => (
                <td key={i} className="px-3 py-1.5 text-center">{p}</td>
              ))}
              <td className="px-3 py-1.5 text-center font-bold">{parTotal}</td>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.length === 0 ? (
              <tr>
                <td colSpan={pars.length + 2} className="px-3 py-4 text-center text-muted-foreground">
                  참가자 없음
                </td>
              </tr>
            ) : (
              sortedPlayers.map((player, idx) => {
                const rowColor = PLAYER_ROW_COLORS[idx % PLAYER_ROW_COLORS.length]
                const publicRowStyle = PUBLIC_ROW_STYLES[idx % PUBLIC_ROW_STYLES.length]
                const rowTone = isPublic ? publicRowStyle.row : rowColor
                const nameTone = isPublic ? publicRowStyle.name : rowColor
                return (
                  <tr key={player.id} className={`border-b border-border/40 ${rowTone}`}>
                    <td className={`sticky left-0 z-10 px-3 py-2 font-semibold shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] ${
                      isPublic
                        ? `${nameTone} backdrop-blur`
                        : nameTone
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          player.rank <= 3
                            ? 'bg-white/70 text-foreground ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10'
                            : 'bg-black/8 text-muted-foreground ring-1 ring-black/5 dark:bg-white/6 dark:ring-white/8'
                        }`}>
                          <Trophy className={`h-3.5 w-3.5 ${trophyTone(player.rank)}`} />
                          {rankLabel(player.rank)}
                        </span>
                        <span>{player.player_name}</span>
                      </div>
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
