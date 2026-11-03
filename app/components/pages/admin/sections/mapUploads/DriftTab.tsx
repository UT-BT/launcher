import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { fetchMapUploadDrift, mapUploadErrorMessage } from '@/app/utils/api'
import type { DriftLocation, DriftRow } from '@/app/utils/mapUploadTypes'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { Feedback, SearchInput, formatDateTime, relTime } from '../../components/controls'
import { adminCardsPlaceholder } from '../../components/AdminCardFace'
import { cn } from '@/lib/utils'
import type { DriftTabProps } from './handover'
import { filterDriftRows, formatSize, shortSha } from './driftView'
import { DRIFT_STATE_LABEL } from './publishLabels'
import { ToneChip } from './ToneChip'

function StateChip({ location }: { location: DriftLocation }) {
  const state = DRIFT_STATE_LABEL[location.state]
  return <ToneChip tone={state.tone} dot>{state.label}</ToneChip>
}

function Sha({ location }: { location: DriftLocation }) {
  return <span className="font-mono text-xs text-muted-foreground" title={location.sha256}>{shortSha(location.sha256)}</span>
}

function Seen({ location }: { location: DriftLocation }) {
  return <span className="text-xs text-muted-foreground" title={formatDateTime(location.last_seen)}>{relTime(location.last_seen)}</span>
}

function Size({ location }: { location: DriftLocation }) {
  return <span className="text-xs text-muted-foreground tabular-nums">{formatSize(location.size)}</span>
}

function Location({ location }: { location: DriftLocation }) {
  return <span className="text-sm text-foreground break-all">{location.location}</span>
}

function perLocation(render: (location: DriftLocation) => ReactNode) {
  return function PerLocation(row: DriftRow) {
    return (
      <ul className="space-y-1">
        {row.locations.map((location) => (
          <li key={location.location} className="flex flex-wrap items-center gap-x-2">
            <span className="text-xs text-muted-foreground">{location.location}</span>
            {render(location)}
          </li>
        ))}
      </ul>
    )
  }
}

const COLUMNS: ResponsiveColumn<DriftRow>[] = [
  { id: 'file', width: '14rem', required: true, tier: 'essential', label: 'File', cell: (row) => <File row={row} /> },
  { id: 'location', width: '8rem', required: true, tier: 'essential', label: 'Location', cell: perLocation(() => null) },
  { id: 'state', width: '7rem', required: true, tier: 'essential', label: 'State', cell: perLocation((location) => <StateChip location={location} />) },
  { id: 'sha', width: '9rem', priority: 60, tier: 'detail', label: 'sha256', cell: perLocation((location) => <Sha location={location} />) },
  { id: 'size', width: '6rem', priority: 50, tier: 'detail', label: 'Size', cell: perLocation((location) => <Size location={location} />) },
  { id: 'seen', width: '7rem', priority: 40, tier: 'detail', label: 'Last seen', cell: perLocation((location) => <Seen location={location} />) },
]

function File({ row }: { row: DriftRow }) {
  return <span className="font-mono text-sm text-foreground break-all">{row.file}</span>
}

function DriftFace({ row }: { row: DriftRow }) {
  return (
    <div className="space-y-2">
      <File row={row} />
      <ul className="space-y-1">
        {row.locations.map((location) => (
          <li key={location.location} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded', location.state !== 'present' && 'bg-red-500/[0.06]')}>
            <Location location={location} />
            <StateChip location={location} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function emptyMessage(rows: DriftRow[], query: string): string {
  return rows.length === 0 ? 'Every host matches the download server.' : `No file matches "${query.trim()}".`
}

export function DriftTab({ token }: DriftTabProps) {
  const [rows, setRows] = useState<DriftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
  const isVisible = (id: string) => !resolved || resolved.has(id)
  const visibleCount = COLUMNS.filter((c) => isVisible(c.id)).length
  const shown = filterDriftRows(rows, query)

  useEffect(() => {
    const controller = new AbortController()
    fetchMapUploadDrift(token, controller.signal)
      .then((next) => { setRows(next); setError(null) })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(mapUploadErrorMessage(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token])

  return (
    <section aria-label="Drift" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">
          Packages whose copies differ between the hosts and the download server. Read only.
        </p>
        <SearchInput value={query} onChange={setQuery} placeholder="Filter by file name…" className="w-full max-w-xs" />
      </div>
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <DataTableShell
        className="!flex-none"
        responsive={{
          columns: COLUMNS, onResolve: handleResolve, compactAriaLabel: 'Drift',
          cards: {
            rows: shown,
            rowKey: (row) => row.file,
            face: (row) => <DriftFace row={row} />,
            placeholder: adminCardsPlaceholder(loading, loading || shown.length === 0, emptyMessage(rows, query)),
          },
        }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="14rem">File</DataTableHeaderCell>
          <DataTableHeaderCell width="8rem">Location</DataTableHeaderCell>
          <DataTableHeaderCell width="7rem">State</DataTableHeaderCell>
          {isVisible('sha') && <DataTableHeaderCell width="9rem">sha256</DataTableHeaderCell>}
          {isVisible('size') && <DataTableHeaderCell width="6rem">Size</DataTableHeaderCell>}
          {isVisible('seen') && <DataTableHeaderCell width="7rem">Last seen</DataTableHeaderCell>}
        </DataTableHeaderRow>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
          ) : shown.length === 0 ? (
            <DataTableEmpty colSpan={visibleCount} message={emptyMessage(rows, query)} />
          ) : shown.flatMap((row) => row.locations.map((location, i) => (
            <DataTableRow key={`${row.file}:${location.location}`} className={location.state === 'present' ? undefined : 'bg-red-500/[0.06]'}>
              {i === 0 && (
                <DataTableCell rowSpan={row.locations.length} className="align-top">
                  <File row={row} />
                </DataTableCell>
              )}
              <DataTableCell><Location location={location} /></DataTableCell>
              <DataTableCell><StateChip location={location} /></DataTableCell>
              {isVisible('sha') && <DataTableCell><Sha location={location} /></DataTableCell>}
              {isVisible('size') && <DataTableCell><Size location={location} /></DataTableCell>}
              {isVisible('seen') && <DataTableCell><Seen location={location} /></DataTableCell>}
            </DataTableRow>
          )))}
        </tbody>
      </DataTableShell>
    </section>
  )
}
