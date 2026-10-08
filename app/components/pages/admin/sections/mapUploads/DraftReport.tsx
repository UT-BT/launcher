import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Clock3, FileArchive, Send, Trash2 } from 'lucide-react'
import { ApiError, fetchMapUploadDraft, mapUploadErrorMessage } from '@/app/utils/api'
import type { Draft } from '@/app/utils/mapUploadTypes'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ActionButton, Feedback, formatDateTime, relTime } from '../../components/controls'
import { DRAFT_STATUS_LABEL } from './reportLabels'
import { draftFieldId, scrollToDraftField } from './reportView'
import { ToneChip } from './ToneChip'
import { DiscardDraftDialog } from './DiscardDraftDialog'
import { DraftExpiry } from './DraftExpiry'
import { DraftWorkspace } from './DraftForm'
import { DraftChecks } from './DraftChecks'
import { DraftFiles } from './DraftFiles'
import { ScreenshotTile, useStagedScreenshot } from './DraftScreenshot'
import { usePollWhile } from './usePollWhile'

function DraftHero({ draft, screenshotUrl, onDiscard, onOpenPublish }: {
  draft: Draft
  screenshotUrl: string | null
  onDiscard: () => void
  onOpenPublish: (id: number) => void
}) {
  const status = DRAFT_STATUS_LABEL[draft.status]
  const publishId = draft.publish_id
  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline/5 bg-card/30">
      {screenshotUrl && (
        <img src={screenshotUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-[0.08] blur-2xl" />
      )}
      <div className="relative flex flex-wrap items-center gap-4 p-4">
        <ScreenshotTile url={screenshotUrl} className="size-16 @xl/draft:size-20" />
        <div className="min-w-0 flex-1 basis-56 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="line-clamp-2 break-all text-lg font-bold leading-tight text-foreground @xl/draft:text-xl">{draft.map_name}</h2>
            <ToneChip tone={status.tone} dot pulse={draft.status === 'analyzing'}>{status.label}</ToneChip>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileArchive className="size-3.5 shrink-0" /><span className="break-all">{draft.source_archive}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <PlayerInfo userId={draft.created_by.id} alias={draft.created_by.alias} size="sm" />
            <span title={formatDateTime(draft.created_at)}>uploaded {relTime(draft.created_at)}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /><DraftExpiry draft={draft} /></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {publishId !== null && <ActionButton icon={Send} onClick={() => onOpenPublish(publishId)}>View publish</ActionButton>}
          <ActionButton tone="red" icon={Trash2} onClick={onDiscard}>Discard</ActionButton>
        </div>
      </div>
    </div>
  )
}

function LoadingDraft() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading the draft">
      <div className="h-28 rounded-xl border border-hairline/5 bg-hairline/[0.03] animate-pulse" />
      <div className="h-40 rounded-xl border border-hairline/5 bg-hairline/[0.03] animate-pulse" />
      <div className="h-64 rounded-xl border border-hairline/5 bg-hairline/[0.03] animate-pulse" />
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
  const [screenshotRevision, setScreenshotRevision] = useState(0)
  const screenshotUrl = useStagedScreenshot(token, draft, screenshotRevision)

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
    <div className="@container/draft space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer">
        <ArrowLeft className="size-3.5" />All drafts
      </button>
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      {!draft ? (
        !error && <LoadingDraft />
      ) : (
        <>
          <DraftHero draft={draft} screenshotUrl={screenshotUrl} onDiscard={() => setDiscarding(true)} onOpenPublish={onOpenPublish} />
          <DraftWorkspace
            token={token}
            draft={draft}
            onDraftChange={setDraft}
            onPublished={onOpenPublish}
            onOpenPublish={onOpenPublish}
            screenshotUrl={screenshotUrl}
            onScreenshotChanged={() => setScreenshotRevision((revision) => revision + 1)}
          >
            <div id={draftFieldId(draft.id, 'checks')} className="scroll-mt-4">
              <DraftChecks draft={draft} onJump={(field) => scrollToDraftField(draft.id, field)} />
            </div>
            {draft.files.length > 0 && <DraftFiles files={draft.files} />}
          </DraftWorkspace>
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
