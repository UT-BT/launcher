import { useCallback, useState } from 'react'
import type { PublishSummary } from '@/app/utils/mapUploadTypes'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { cn } from '@/lib/utils'
import { formatDateTime, relTime } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { AdminCardFace, adminCardsPlaceholder } from '../../components/AdminCardFace'
import { ACTIVATION_LABEL, PUBLISH_STATE_LABEL } from './publishLabels'
import { ToneChip } from './ToneChip'
import { isPublishSettled } from './publishState'

function StateChip({ publish }: { publish: PublishSummary }) {
  const state = PUBLISH_STATE_LABEL[publish.state]
  return <ToneChip tone={state.tone} dot pulse={!isPublishSettled(publish.state)}>{state.label}</ToneChip>
}

function MapCell({ publish }: { publish: PublishSummary }) {
  return (
    <div className="min-w-0">
      <p className="break-all text-sm font-semibold text-foreground group-hover:text-accent-200">{publish.map_name}</p>
      {publish.state === 'failed' && publish.error && <p className="text-xs text-red-300 break-words">{publish.error}</p>}
    </div>
  )
}

function Hosts({ publish }: { publish: PublishSummary }) {
  const percent = publish.hosts_total === 0 ? 0 : Math.round((publish.hosts_confirmed / publish.hosts_total) * 100)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-hairline/10" aria-hidden>
        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{publish.hosts_confirmed}/{publish.hosts_total}</span>
    </span>
  )
}

function Created({ publish }: { publish: PublishSummary }) {
  return <span className="text-xs text-muted-foreground" title={formatDateTime(publish.created_at)}>{relTime(publish.created_at)}</span>
}

function Activation({ publish }: { publish: PublishSummary }) {
  return <span className="text-xs text-muted-foreground">{publish.activation ? ACTIVATION_LABEL[publish.activation] : '—'}</span>
}

const COLUMNS: ResponsiveColumn<PublishSummary>[] = [
  { id: 'map', required: true, tier: 'essential', label: 'Map', cell: (publish) => <MapCell publish={publish} /> },
  { id: 'state', width: '10rem', required: true, tier: 'essential', label: 'State', cell: (publish) => <StateChip publish={publish} /> },
  { id: 'hosts', width: '8rem', priority: 65, tier: 'detail', label: 'Hosts', cell: (publish) => <Hosts publish={publish} /> },
  { id: 'created', width: '8rem', priority: 50, tier: 'detail', label: 'Created', cell: (publish) => <Created publish={publish} /> },
  { id: 'activation', width: '8rem', priority: 40, tier: 'detail', label: 'Went live', cell: (publish) => <Activation publish={publish} /> },
]

export function PublishList({ publishes, loading, selectedId, onSelect }: {
  publishes: PublishSummary[]
  loading: boolean
  selectedId: number | null
  onSelect: (publishId: number) => void
}) {
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
  const isVisible = (id: string) => !resolved || resolved.has(id)
  const visibleCount = COLUMNS.filter((c) => isVisible(c.id)).length
  const selectedClass = (id: number) => (id === selectedId ? 'bg-accent-500/[0.08]' : undefined)

  return (
    <section aria-label="Recent publishes" className="space-y-2">
      <h3 className={PANEL_LABEL}>Recent publishes</h3>
      <DataTableShell
        className="!flex-none"
        responsive={{
          columns: COLUMNS, onResolve: handleResolve, compactAriaLabel: 'Recent publishes',
          cards: {
            rows: publishes,
            rowKey: (publish) => String(publish.id),
            face: (publish) => <AdminCardFace columns={COLUMNS} row={publish} />,
            onOpen: (publish) => onSelect(publish.id),
            rowClassName: (publish) => selectedClass(publish.id),
            placeholder: adminCardsPlaceholder(loading, loading || publishes.length === 0, 'Nothing has been published yet.'),
          },
        }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell>Map</DataTableHeaderCell>
          <DataTableHeaderCell width="10rem">State</DataTableHeaderCell>
          {isVisible('hosts') && <DataTableHeaderCell width="8rem">Hosts</DataTableHeaderCell>}
          {isVisible('created') && <DataTableHeaderCell width="8rem">Created</DataTableHeaderCell>}
          {isVisible('activation') && <DataTableHeaderCell width="8rem">Went live</DataTableHeaderCell>}
        </DataTableHeaderRow>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
          ) : publishes.length === 0 ? (
            <DataTableEmpty colSpan={visibleCount} message="Nothing has been published yet." />
          ) : publishes.map((publish) => (
            <DataTableRow key={publish.id} onClick={() => onSelect(publish.id)} className={cn('cursor-pointer', selectedClass(publish.id))}>
              {COLUMNS.filter((c) => isVisible(c.id)).map((c) => <DataTableCell key={c.id}>{c.cell?.(publish)}</DataTableCell>)}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
    </section>
  )
}
