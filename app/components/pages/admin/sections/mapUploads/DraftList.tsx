import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, FolderOpen, OctagonX, Trash2, X } from 'lucide-react'
import { Spinner } from '@/app/components/ui/spinner'
import { fetchMapUploadDrafts, mapUploadErrorMessage } from '@/app/utils/api'
import type { DraftSummary } from '@/app/utils/mapUploadTypes'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, DataTableEmpty,
  DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { ActionButton, Feedback } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { AdminCardFace, adminCardsPlaceholder } from '../../components/AdminCardFace'
import { DRAFT_STATUS_LABEL, countLabel } from './reportLabels'
import { ToneChip } from './ToneChip'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftExpiry } from './DraftExpiry'
import { usePollWhile } from './usePollWhile'

type DraftColumn = Omit<ResponsiveColumn<DraftSummary>, 'cell'>

const COLUMNS: DraftColumn[] = [
  { id: 'map', required: true, tier: 'essential', label: 'Map' },
  { id: 'status', width: '8rem', required: true, tier: 'essential', label: 'Status' },
  { id: 'issues', width: '8rem', priority: 65, tier: 'detail', label: 'Issues' },
  { id: 'creator', width: '10rem', priority: 50, tier: 'detail', label: 'Uploaded by' },
  { id: 'expires', width: '8rem', priority: 40, tier: 'detail', label: 'Expires' },
  { id: 'actions', width: '7.5rem', required: true, tier: 'essential', label: 'Actions' },
]

function Issues({ draft }: { draft: DraftSummary }) {
  if (draft.status === 'analyzing') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner className="size-3.5" />Checking</span>
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

  const draftCell = (id: string, draft: DraftSummary) => {
    switch (id) {
      case 'map': return <MapCell draft={draft} />
      case 'status': return <StatusChip draft={draft} />
      case 'issues': return <Issues draft={draft} />
      case 'creator': return <PlayerInfo userId={draft.created_by.id} alias={draft.created_by.alias} size="sm" />
      case 'expires': return <span className="text-xs text-muted-foreground"><DraftExpiry draft={draft} /></span>
      case 'actions': return <RowActions onOpen={() => onOpenDraft(draft.id)} onDiscard={() => setDiscardTarget(draft)} />
      default: return null
    }
  }

  const columns: ResponsiveColumn<DraftSummary>[] = COLUMNS.map((c) => ({ ...c, cell: (draft) => draftCell(c.id, draft) }))

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
        responsive={{
          columns, onResolve: handleResolve, compactAriaLabel: 'Drafts',
          cards: {
            rows: drafts,
            rowKey: (draft) => String(draft.id),
            face: (draft) => <AdminCardFace columns={columns} row={draft} />,
            onOpen: (draft) => onOpenDraft(draft.id),
            placeholder: adminCardsPlaceholder(loading, loading || drafts.length === 0, 'No drafts. Upload an archive to start one.'),
          },
        }}
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
              {COLUMNS.filter((c) => isVisible(c.id)).map((c) => (
                <DataTableCell key={c.id} align={c.id === 'actions' ? 'right' : undefined}>{draftCell(c.id, draft)}</DataTableCell>
              ))}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
      <DiscardDraftDialog token={token} target={discardTarget} onCancel={() => setDiscardTarget(null)} onDiscarded={onDiscarded} />
    </section>
  )
}
