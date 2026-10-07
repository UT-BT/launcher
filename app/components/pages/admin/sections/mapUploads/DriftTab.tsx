import { useCallback, useEffect, useState } from 'react'
import { fetchMapUploadDrift, mapUploadErrorMessage } from '@/app/utils/api'
import type { DriftLocation, DriftRow } from '@/app/utils/mapUploadTypes'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { Feedback, SearchInput, formatDateTime, relTime } from '../../components/controls'
import type { DriftTabProps } from './handover'
import { filterDriftRows, formatSize, shortSha } from './driftView'
import { DRIFT_STATE_LABEL } from './publishLabels'
import { ToneChip } from './ToneChip'

const COLUMNS: ResponsiveColumn[] = [
  { id: 'file', width: '14rem', required: true },
  { id: 'location', width: '8rem', required: true },
  { id: 'state', width: '7rem', required: true },
  { id: 'sha', width: '9rem', priority: 60 },
  { id: 'size', width: '6rem', priority: 50 },
  { id: 'seen', width: '7rem', priority: 40 },
]

function StateChip({ location }: { location: DriftLocation }) {
  const state = DRIFT_STATE_LABEL[location.state]
  return <ToneChip tone={state.tone}>{state.label}</ToneChip>
}

function Sha({ location }: { location: DriftLocation }) {
  return <span className="font-mono text-xs text-muted-foreground" title={location.sha256}>{shortSha(location.sha256)}</span>
}

function Seen({ location }: { location: DriftLocation }) {
  return <span className="text-xs text-muted-foreground" title={formatDateTime(location.last_seen)}>{relTime(location.last_seen)}</span>
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

  const compactRows = (
    <ul className="space-y-2">
      {shown.map((row) => (
        <li key={row.file} className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 space-y-2">
          <p className="text-sm font-mono text-foreground break-all">{row.file}</p>
          <ul className="space-y-1">
            {row.locations.map((location) => (
              <li key={location.location} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-foreground">{location.location}</span>
                <StateChip location={location} />
                <Sha location={location} />
                <span className="text-xs text-muted-foreground">{formatSize(location.size)}</span>
                <Seen location={location} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label="Drift" className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Packages whose copies differ between the hosts and the download server. Read only.
      </p>
      <SearchInput value={query} onChange={setQuery} placeholder="Filter by file name…" className="max-w-sm" />
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <DataTableShell
        className="!flex-none"
        responsive={{ columns: COLUMNS, onResolve: handleResolve, compactContent: compactRows, compactAriaLabel: 'Drift' }}
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
                  <span className="font-mono text-sm text-foreground break-all">{row.file}</span>
                </DataTableCell>
              )}
              <DataTableCell><span className="text-sm text-foreground break-all">{location.location}</span></DataTableCell>
              <DataTableCell><StateChip location={location} /></DataTableCell>
              {isVisible('sha') && <DataTableCell><Sha location={location} /></DataTableCell>}
              {isVisible('size') && <DataTableCell><span className="text-xs text-muted-foreground tabular-nums">{formatSize(location.size)}</span></DataTableCell>}
              {isVisible('seen') && <DataTableCell><Seen location={location} /></DataTableCell>}
            </DataTableRow>
          )))}
        </tbody>
      </DataTableShell>
    </section>
  )
}
