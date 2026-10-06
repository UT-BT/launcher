import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, OctagonX, Send, Trash2 } from 'lucide-react'
import { ApiError, fetchMapUploadDraft, mapUploadErrorMessage } from '@/app/utils/api'
import type { Draft, DraftBlock, DraftFile } from '@/app/utils/mapUploadTypes'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
  DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { ActionButton, Feedback, formatDateTime, relTime } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { BLOCK_TITLE, DISPOSITION_LABEL, DRAFT_STATUS_LABEL, FILE_KIND_LABEL, WARNING_TITLE, fileReason } from './reportLabels'
import { ToneChip } from './ToneChip'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftExpiry } from './DraftExpiry'
import { DraftForm } from './DraftForm'
import { usePollWhile } from './usePollWhile'

const FILE_COLUMNS: ResponsiveColumn[] = [
  { id: 'file', width: '14rem', required: true },
  { id: 'kind', width: '9rem', priority: 50 },
  { id: 'disposition', width: '9rem', required: true },
  { id: 'reason', width: '20rem', priority: 60 },
]

function BlockItem({ block }: { block: DraftBlock }) {
  return (
    <li className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 space-y-1 text-red-200">
      <p className="text-sm font-medium">{BLOCK_TITLE[block.code]}</p>
      <p className="text-xs">{block.message}</p>
      {block.package && <p className="text-xs">Package: <span className="font-mono break-all">{block.package}</span></p>}
      {block.hosts.length > 0 && <p className="text-xs">On: {block.hosts.join(', ')}</p>}
      {block.objects.length > 0 && <p className="text-xs break-words">Missing objects: <span className="font-mono">{block.objects.join(', ')}</span></p>}
    </li>
  )
}

function Findings({ draft }: { draft: Draft }) {
  if (draft.status === 'analyzing') return null
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section aria-label="Blocks" className="space-y-2">
        <h3 className={PANEL_LABEL}>Blocks</h3>
        {draft.blocks.length === 0 ? (
          <p className="inline-flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="size-4" />Nothing blocks publishing.</p>
        ) : (
          <ul className="space-y-2">{draft.blocks.map((block, i) => <BlockItem key={`${block.code}-${i}`} block={block} />)}</ul>
        )}
      </section>
      <section aria-label="Warnings" className="space-y-2">
        <h3 className={PANEL_LABEL}>Warnings</h3>
        {draft.warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warnings.</p>
        ) : (
          <ul className="space-y-2">
            {draft.warnings.map((warning, i) => (
              <li key={`${warning.code}-${i}`} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 space-y-1 text-amber-200">
                <p className="text-sm font-medium">{WARNING_TITLE[warning.code]}</p>
                <p className="text-xs">{warning.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function DispositionChip({ file }: { file: DraftFile }) {
  const disposition = DISPOSITION_LABEL[file.disposition]
  return <ToneChip tone={disposition.tone}>{disposition.label}</ToneChip>
}

function FilesTable({ files }: { files: DraftFile[] }) {
  const [resolved, setResolved] = useState<Set<string> | null>(null)
  const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
  const isVisible = (id: string) => !resolved || resolved.has(id)

  const compactRows = (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.file} className="rounded-lg border border-hairline/10 bg-card/30 px-4 py-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-mono text-foreground break-all">{file.file}</span>
            <DispositionChip file={file} />
          </div>
          <p className="text-xs text-muted-foreground">{FILE_KIND_LABEL[file.kind]} · {fileReason(file)}</p>
        </li>
      ))}
    </ul>
  )

  return (
    <section aria-label="Files" className="space-y-2">
      <h3 className={PANEL_LABEL}>Files in the archive</h3>
      <DataTableShell
        className="!flex-none"
        responsive={{ columns: FILE_COLUMNS, onResolve: handleResolve, compactContent: compactRows, compactAriaLabel: 'Files' }}
      >
        <DataTableHeaderRow>
          <DataTableHeaderCell width="14rem">File</DataTableHeaderCell>
          {isVisible('kind') && <DataTableHeaderCell width="9rem">Kind</DataTableHeaderCell>}
          <DataTableHeaderCell width="9rem">What happens</DataTableHeaderCell>
          {isVisible('reason') && <DataTableHeaderCell width="20rem">Why</DataTableHeaderCell>}
        </DataTableHeaderRow>
        <tbody>
          {files.map((file) => (
            <DataTableRow key={file.file}>
              <DataTableCell><span className="font-mono text-sm text-foreground break-all">{file.file}</span></DataTableCell>
              {isVisible('kind') && <DataTableCell><span className="text-xs text-muted-foreground">{FILE_KIND_LABEL[file.kind]}</span></DataTableCell>}
              <DataTableCell><DispositionChip file={file} /></DataTableCell>
              {isVisible('reason') && <DataTableCell><span className="text-xs text-muted-foreground">{fileReason(file)}</span></DataTableCell>}
            </DataTableRow>
          ))}
        </tbody>
      </DataTableShell>
    </section>
  )
}

function ReportHeader({ draft, onDiscard, onOpenPublish }: { draft: Draft; onDiscard: () => void; onOpenPublish: (id: number) => void }) {
  const status = DRAFT_STATUS_LABEL[draft.status]
  const publishId = draft.publish_id
  return (
    <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground break-all">{draft.map_name}</h2>
            <ToneChip tone={status.tone}>{status.label}</ToneChip>
          </div>
          <p className="text-xs text-muted-foreground break-all">from {draft.source_archive}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publishId !== null && <ActionButton icon={Send} onClick={() => onOpenPublish(publishId)}>View publish</ActionButton>}
          <ActionButton tone="red" icon={Trash2} onClick={onDiscard}>Discard</ActionButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">Created by <PlayerInfo userId={draft.created_by.id} alias={draft.created_by.alias} size="sm" /></span>
        <span title={formatDateTime(draft.created_at)}>{relTime(draft.created_at)}</span>
        <DraftExpiry draft={draft} />
      </div>
      {draft.status === 'analyzing' && (
        <p className="inline-flex items-center gap-2 text-sm text-amber-300">
          <Loader2 className="size-4 animate-spin" />Checking the archive. This report updates by itself.
        </p>
      )}
      {draft.status === 'invalid' && (
        <p className="inline-flex items-center gap-2 text-sm text-red-300"><OctagonX className="size-4" />This draft cannot be published until its blocks are fixed.</p>
      )}
      {draft.status === 'ready' && draft.warnings.length > 0 && (
        <p className="inline-flex items-center gap-2 text-sm text-amber-300"><AlertTriangle className="size-4" />Read the warnings before publishing.</p>
      )}
    </div>
  )
}

export function DraftReport({ token, draftId, onBack, onDiscarded, onOpenPublish }: {
  token: string
  draftId: number
  onBack: () => void
  onDiscarded: (draftId: number) => void
  onOpenPublish: (publishId: number) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setDraft(await fetchMapUploadDraft(token, draftId, signal))
      setError(null)
    } catch (e) {
      if (signal?.aborted) return
      if (e instanceof ApiError && e.status === 404) setDraft(null)
      setError(mapUploadErrorMessage(e))
    }
  }, [token, draftId])

  useEffect(() => {
    setDraft(null)
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  usePollWhile(draft?.status === 'analyzing', load)

  return (
    <div className="space-y-4">
      <ActionButton icon={ArrowLeft} onClick={onBack}>All drafts</ActionButton>
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      {!draft ? (
        !error && <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading the draft…</p>
      ) : (
        <>
          <ReportHeader draft={draft} onDiscard={() => setDiscarding(true)} onOpenPublish={onOpenPublish} />
          <Findings draft={draft} />
          <FilesTable files={draft.files} />
          <DraftForm token={token} draft={draft} onDraftChange={setDraft} onPublished={onOpenPublish} />
        </>
      )}
      <DiscardDraftDialog
        token={token}
        target={discarding ? draft : null}
        onCancel={() => setDiscarding(false)}
        onDiscarded={(id) => { setDiscarding(false); onDiscarded(id) }}
      />
    </div>
  )
}
