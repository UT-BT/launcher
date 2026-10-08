import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, FolderOpen, Loader2, OctagonX, Trash2, X } from 'lucide-react'
import { fetchMapUploadDrafts, mapUploadErrorMessage } from '@/app/utils/api'
import type { DraftSummary } from '@/app/utils/mapUploadTypes'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { ActionButton, Feedback } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { DRAFT_STATUS_LABEL, countLabel } from './reportLabels'
import { ToneChip } from './ToneChip'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftExpiry } from './DraftExpiry'
import { usePollWhile } from './usePollWhile'

const COLUMNS: ResponsiveColumn[] = [
  { id: 'map', required: true },
  { id: 'status', width: '8rem', required: true },
  { id: 'issues', width: '8rem', priority: 65 },
  { id: 'creator', width: '10rem', priority: 50 },
  { id: 'expires', width: '8rem', priority: 40 },
  { id: 'actions', width: '7.5rem', required: true },
]

function Issues({ draft }: { draft: DraftSummary }) {
  if (draft.status === 'analyzing') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Checking</span>
  }
  if (draft.blocks_count === 0 && draft.warnings_count === 0) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="size-3.5" />Clean</span>
  }
  return (
    <span className="inline-flex items-center gap-3 text-xs font-medium tabular-nums">
      {draft.blocks_count > 0 && (
        <span className="inline-flex items-center gap-1 text-red-300" title={countLabel(draft.blocks_count, 'block')}>
          <OctagonX className="size-3.5" />{draft.blocks_count}
        </span>
      )}
      {draft.warnings_count > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-300" title={countLabel(draft.warnings_count, 'warning')}>
          <AlertTriangle className="size-3.5" />{draft.warnings_count}
        </span>
      )}
    </span>
  )
}

function StatusChip({ draft }: { draft: DraftSummary }) {
  const status = DRAFT_STATUS_LABEL[draft.status]
  return <ToneChip tone={status.tone} dot pulse={draft.status === 'analyzing'}>{status.label}</ToneChip>
}

function stop(handler: () => void) {
  return (event: MouseEvent) => {
    event.stopPropagation()
    handler()
  }
}

function RowActions({ onOpen, onDiscard }: { onOpen: () => void; onDiscard: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={stop(onDiscard)}
        title="Discard"
        aria-label="Discard"
        className="inline-flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
      >
        <Trash2 className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={stop(onOpen)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-accent-500/40 bg-accent-500/15 pl-3 pr-2 text-xs font-medium text-accent-200 transition-colors hover:bg-accent-500/25 cursor-pointer"
      >
        Open<ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

function MapCell({ draft }: { draft: DraftSummary }) {
  return (
    <div className="min-w-0">
      <p className="break-all text-sm font-semibold text-foreground group-hover:text-accent-200">{draft.map_name}</p>
      <p className="truncate text-xs text-muted-foreground" title={draft.source_archive}>{draft.source_archive}</p>
    </div>
  )
}

function UploadedDrafts({ drafts, onOpen, onDismiss }: {
  drafts: DraftSummary[]
  onOpen: (id: number) => void
  onDismiss: () => void
}) {
  return (
    <section aria-label="Drafts from this upload" className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
          <CheckCircle2 className="size-4" />This archive made {countLabel(drafts.length, 'draft')}
        </p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-4" />
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <ActionButton tone="emerald" icon={FolderOpen} onClick={() => onOpen(draft.id)}>{draft.map_name}</ActionButton>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DraftList({ token, refreshKey, uploadedIds, onDismissUploaded, onOpenDraft }: {
  token: string
  refreshKey: number
  uploadedIds: number[]
  onDismissUploaded: () => void
  onOpenDraft: (id: number) => void
}) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [discardTarget, setDiscardTarget] = useState<DraftSummary | null>(null)
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
  const isVisible = (id: string) => !resolved || resolved.has(id)
  const visibleCount = COLUMNS.filter((c) => isVisible(c.id)).length
  const uploaded = uploadedIds.length > 1 ? drafts.filter((d) => uploadedIds.includes(d.id)) : []

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setDrafts(await fetchMapUploadDrafts(token, signal))
      setError(null)
    } catch (e) {
      if (!signal?.aborted) setError(mapUploadErrorMessage(e))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, refreshKey])

  usePollWhile(drafts.some((d) => d.status === 'analyzing'), load)

  const onDiscarded = (id: number) => {
    setDiscardTarget(null)
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const compactRows = (
    <ul className="space-y-2">
      {loading && Array.from({ length: 3 }).map((_, i) => <li key={i} className="h-24 rounded-xl border border-hairline/5 bg-hairline/[0.03] animate-pulse" />)}
      {!loading && drafts.length === 0 && <li className="px-4 py-12 text-center text-sm text-muted-foreground">No drafts. Upload an archive to start one.</li>}
      {!loading && drafts.map((draft) => (
        <li key={draft.id} className="rounded-xl border border-hairline/5 bg-card/30 px-4 py-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <MapCell draft={draft} />
            <StatusChip draft={draft} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <Issues draft={draft} />
            <PlayerInfo userId={draft.created_by.id} alias={draft.created_by.alias} size="sm" />
            <span className="text-xs text-muted-foreground"><DraftExpiry draft={draft} /></span>
          </div>
          <RowActions onOpen={() => onOpenDraft(draft.id)} onDiscard={() => setDiscardTarget(draft)} />
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label="Drafts" className="space-y-3">
      {uploaded.length > 0 && <UploadedDrafts drafts={uploaded} onOpen={onOpenDraft} onDismiss={onDismissUploaded} />}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={PANEL_LABEL}>Drafts{!loading && drafts.length > 0 && <span className="ml-1.5 tabular-nums text-muted-foreground/70">{drafts.length}</span>}</h3>
        <p className="text-xs text-muted-foreground">Unpublished drafts are deleted after 14 days.</p>
      </div>
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <DataTableShell
        className="!flex-none"
        responsive={{ columns: COLUMNS, onResolve: handleResolve, compactContent: compactRows, compactAriaLabel: 'Drafts' }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell>Map</DataTableHeaderCell>
          <DataTableHeaderCell width="8rem">Status</DataTableHeaderCell>
          {isVisible('issues') && <DataTableHeaderCell width="8rem">Issues</DataTableHeaderCell>}
          {isVisible('creator') && <DataTableHeaderCell width="10rem">Uploaded by</DataTableHeaderCell>}
          {isVisible('expires') && <DataTableHeaderCell width="8rem">Expires</DataTableHeaderCell>}
          <DataTableHeaderCell width="7.5rem" align="right"><span className="sr-only">Actions</span></DataTableHeaderCell>
        </DataTableHeaderRow>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
          ) : drafts.length === 0 ? (
            <DataTableEmpty colSpan={visibleCount} message="No drafts. Upload an archive to start one." />
          ) : drafts.map((draft) => (
            <DataTableRow key={draft.id} onClick={() => onOpenDraft(draft.id)} className="cursor-pointer">
              <DataTableCell><MapCell draft={draft} /></DataTableCell>
              <DataTableCell><StatusChip draft={draft} /></DataTableCell>
              {isVisible('issues') && <DataTableCell><Issues draft={draft} /></DataTableCell>}
              {isVisible('creator') && (
                <DataTableCell><PlayerInfo userId={draft.created_by.id} alias={draft.created_by.alias} size="sm" /></DataTableCell>
              )}
              {isVisible('expires') && <DataTableCell><span className="text-xs text-muted-foreground"><DraftExpiry draft={draft} /></span></DataTableCell>}
              <DataTableCell align="right">
                <RowActions onOpen={() => onOpenDraft(draft.id)} onDiscard={() => setDiscardTarget(draft)} />
              </DataTableCell>
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
      <DiscardDraftDialog token={token} target={discardTarget} onCancel={() => setDiscardTarget(null)} onDiscarded={onDiscarded} />
    </section>
  )
}
