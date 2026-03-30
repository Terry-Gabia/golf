import { useState } from 'react'
import { Plus } from 'lucide-react'
import { GolfRecordCard } from './GolfRecordCard'
import { GolfRecordForm } from './GolfRecordForm'
import { PLAY_TYPES } from '@/types'
import type { GolfRecord, PlayType } from '@/types'

interface Props {
  records: GolfRecord[]
  loading: boolean
  onAdd: (data: { play_type: PlayType; cc_name: string; play_date: string; score: number | null; memo: string | null }) => Promise<void>
  onUpdate: (id: string, data: Partial<{ play_type: PlayType; cc_name: string; play_date: string; score: number | null; memo: string | null }>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function GolfRecordList({ records, loading, onAdd, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editRecord, setEditRecord] = useState<GolfRecord | null>(null)
  const [filter, setFilter] = useState<PlayType | '전체'>('전체')

  const filtered = filter === '전체' ? records : records.filter((r) => r.play_type === filter)

  const counts: Record<string, number> = {
    '전체': records.length,
    ...Object.fromEntries(PLAY_TYPES.map((t) => [t, records.filter((r) => r.play_type === t).length])),
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {(['전체', ...PLAY_TYPES] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {type} <span className="ml-1 text-xs opacity-70">{counts[type]}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          {records.length === 0 ? '아직 기록이 없습니다. 첫 기록을 추가해보세요!' : '해당 조건의 기록이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <GolfRecordCard
              key={record.id}
              record={record}
              onEdit={(r) => setEditRecord(r)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <GolfRecordForm onSubmit={onAdd} onClose={() => setShowForm(false)} />
      )}

      {editRecord && (
        <GolfRecordForm
          record={editRecord}
          onSubmit={async (data) => {
            await onUpdate(editRecord.id, data)
          }}
          onClose={() => setEditRecord(null)}
        />
      )}
    </div>
  )
}
