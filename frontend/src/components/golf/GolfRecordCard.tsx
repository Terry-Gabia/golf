import { Pencil, Trash2 } from 'lucide-react'
import { PLAY_TYPE_COLORS } from '@/types'
import type { GolfRecord } from '@/types'

interface Props {
  record: GolfRecord
  onEdit: (record: GolfRecord) => void
  onDelete: (id: string) => void
}

export function GolfRecordCard({ record, onEdit, onDelete }: Props) {
  const colors = PLAY_TYPE_COLORS[record.play_type]

  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {record.play_type}
            </span>
            <span className="font-semibold">{record.cc_name}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{record.play_date}</span>
            {record.score && (
              <span className="font-semibold text-foreground">{record.score}타</span>
            )}
          </div>
          {record.memo && (
            <p className="mt-1.5 text-sm text-muted-foreground">{record.memo}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(record)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(record.id)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
