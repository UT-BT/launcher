import { useCallback, useState } from 'react'
import type { PublishSummary } from '@/app/utils/mapUploadTypes'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { cn } from '@/lib/utils'
import { formatDateTime, relTime } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { ACTIVATION_LABEL, PUBLISH_STATE_LABEL } from './publishLabels'
import { ToneChip } from './ToneChip'

const COLUMNS: ResponsiveColumn[] = [
  { id: 'map', width: '16rem', required: true },
  { id: 'state', width: '10rem', required: true },
  { id: 'hosts', width: '8rem', priority: 65 },
  { id: 'created', width: '8rem', priority: 50 },
  { id: 'activation', width: '8rem', priority: 40 },
]

function StateChip({ publish }: { publish: PublishSummary }) {
  const state = PUBLISH_STATE_LABEL[publish.state]
  return <ToneChip tone={state.tone}>{state.label}</ToneChip>
}

function MapCell({ publish, onSelect }: { publish: PublishSummary; onSelect: () => void }) {
  return (
    <div className="min-w-0">
      <button type="button" onClick={onSelect} className="text-sm font-semibold text-foreground hover:text-accent-300 cursor-pointer text-left break-all">
        {publish.map_name}
      </button>
      {publish.state === 'failed' && publish.error && <p className="text-xs text-red-300 break-words">{publish.error}</p>}
    </div>
  )
}

function Hosts({ publish }: { publish: PublishSummary }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{publish.hosts_confirmed} of {publish.hosts_total}</span>
}

function Created({ publish }: { publish: PublishSummary }) {
  return <span className="text-xs text-muted-foreground" title={formatDateTime(publish.created_at)}>{relTime(publish.created_at)}</span>
}

function Activation({ publish }: { publish: PublishSummary }) {
  return <span className="text-xs text-muted-foreground">{publish.activation ? ACTIVATION_LABEL[publish.activation] : '—'}</span>
}

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
  const selectedClass = (id: number) => (id === selectedId ? 'bg-accent-500/[0.06]' : undefined)

  const compactRows = (
    <ul className="space-y-2">
      {publishes.map((publish) => (
        <li key={publish.id} className={cn('rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 space-y-2', selectedClass(publish.id))}>
          <div className="flex items-start justify-between gap-2">
            <MapCell publish={publish} onSelect={() => onSelect(publish.id)} />
            <StateChip publish={publish} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-muted-foreground">Hosts <Hosts publish={publish} /></span>
            <Created publish={publish} />
            {publish.activation && <Activation publish={publish} />}
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label="Recent publishes" className="space-y-2">
      <h3 className={PANEL_LABEL}>Recent publishes</h3>
      <DataTableShell
        className="!flex-none"
        responsive={{ columns: COLUMNS, onResolve: handleResolve, compactContent: compactRows, compactAriaLabel: 'Recent publishes' }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="16rem">Map</DataTableHeaderCell>
          <DataTableHeaderCell width="10rem">State</DataTableHeaderCell>
          {isVisible('hosts') && <DataTableHeaderCell width="8rem">Hosts confirmed</DataTableHeaderCell>}
          {isVisible('created') && <DataTableHeaderCell width="8rem">Created</DataTableHeaderCell>}
          {isVisible('activation') && <DataTableHeaderCell width="8rem">Went live</DataTableHeaderCell>}
        </DataTableHeaderRow>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
          ) : publishes.length === 0 ? (
            <DataTableEmpty colSpan={visibleCount} message="Nothing has been published yet." />
          ) : publishes.map((publish) => (
            <DataTableRow key={publish.id} className={selectedClass(publish.id)}>
              <DataTableCell><MapCell publish={publish} onSelect={() => onSelect(publish.id)} /></DataTableCell>
              <DataTableCell><StateChip publish={publish} /></DataTableCell>
              {isVisible('hosts') && <DataTableCell><Hosts publish={publish} /></DataTableCell>}
              {isVisible('created') && <DataTableCell><Created publish={publish} /></DataTableCell>}
              {isVisible('activation') && <DataTableCell><Activation publish={publish} /></DataTableCell>}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
    </section>
  )
}
