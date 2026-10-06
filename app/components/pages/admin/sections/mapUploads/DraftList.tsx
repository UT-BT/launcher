import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Trash2, X } from 'lucide-react'
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
  { id: 'map', width: '16rem', required: true },
  { id: 'status', width: '8rem', required: true },
  { id: 'issues', width: '10rem', priority: 65 },
  { id: 'creator', width: '11rem', priority: 50 },
  { id: 'expires', width: '8rem', priority: 40 },
  { id: 'actions', width: '13rem', required: true },
]

function Issues({ draft }: { draft: DraftSummary }) {
  if (draft.status === 'analyzing') return <span className="text-xs text-muted-foreground">Checking…</span>
  if (draft.blocks_count === 0 && draft.warnings_count === 0) return <span className="text-xs text-muted-foreground">None</span>
  return (
    <span className="flex flex-wrap gap-1">
      {draft.blocks_count > 0 && <ToneChip tone="red">{countLabel(draft.blocks_count, 'block')}</ToneChip>}
      {draft.warnings_count > 0 && <ToneChip tone="amber">{countLabel(draft.warnings_count, 'warning')}</ToneChip>}
    </span>
  )
}

function StatusChip({ draft }: { draft: DraftSummary }) {
  const status = DRAFT_STATUS_LABEL[draft.status]
  return <ToneChip tone={status.tone}>{status.label}</ToneChip>
}

function RowActions({ onOpen, onDiscard }: { onOpen: () => void; onDiscard: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ActionButton icon={FolderOpen} onClick={onOpen}>Open</ActionButton>
      <ActionButton tone="red" icon={Trash2} onClick={onDiscard}>Discard</ActionButton>
    </div>
  )
}

function MapCell({ draft, onOpen }: { draft: DraftSummary; onOpen: () => void }) {
  return (
    <div className="min-w-0">
      <button type="button" onClick={onOpen} className="text-sm font-semibold text-foreground hover:text-accent-300 cursor-pointer text-left break-all">
        {draft.map_name}
      </button>
      <div className="text-xs text-muted-foreground break-all">{draft.source_archive}</div>
    </div>
  )
}

function UploadedDrafts({ drafts, onOpen, onDismiss }: {
  drafts: DraftSummary[]
  onOpen: (id: number) => void
  onDismiss: () => void
}) {
  return (
    <section aria-label="Drafts from this upload" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className={PANEL_LABEL}>This archive made {countLabel(drafts.length, 'draft')}</h3>
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
      {drafts.map((draft) => (
        <li key={draft.id} className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <MapCell draft={draft} onOpen={() => onOpenDraft(draft.id)} />
            <StatusChip draft={draft} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <DataTableShell
        className="!flex-none"
        responsive={{ columns: COLUMNS, onResolve: handleResolve, compactContent: compactRows, compactAriaLabel: 'Drafts' }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="16rem">Map</DataTableHeaderCell>
          <DataTableHeaderCell width="8rem">Status</DataTableHeaderCell>
          {isVisible('issues') && <DataTableHeaderCell width="10rem">Blocks / warnings</DataTableHeaderCell>}
          {isVisible('creator') && <DataTableHeaderCell width="11rem">Created by</DataTableHeaderCell>}
          {isVisible('expires') && <DataTableHeaderCell width="8rem">Expires</DataTableHeaderCell>}
          <DataTableHeaderCell width="13rem" align="right">Actions</DataTableHeaderCell>
        </DataTableHeaderRow>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
          ) : drafts.length === 0 ? (
            <DataTableEmpty colSpan={visibleCount} message="No drafts. Upload an archive to start one." />
          ) : drafts.map((draft) => (
            <DataTableRow key={draft.id}>
              <DataTableCell><MapCell draft={draft} onOpen={() => onOpenDraft(draft.id)} /></DataTableCell>
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
