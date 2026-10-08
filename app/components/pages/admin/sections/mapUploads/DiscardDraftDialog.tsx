import { useEffect, useState } from 'react'
import { discardMapUploadDraft, mapUploadErrorMessage } from '@/app/utils/api'
import type { DraftSummary } from '@/app/utils/mapUploadTypes'
import { ConfirmDialog, Feedback } from '../../components/controls'

export type DiscardTarget = Pick<DraftSummary, 'id' | 'map_name' | 'source_archive' | 'publish_id'>

export function DiscardDraftDialog({ token, target, onCancel, onDiscarded }: {
  token: string
  target: DiscardTarget | null
  onCancel: () => void
  onDiscarded: (draftId: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setError(null) }, [target])

  const discard = async () => {
    if (!target) return
    setBusy(true); setError(null)
    try {
      await discardMapUploadDraft(token, target.id)
      onDiscarded(target.id)
    } catch (e) {
      setError(mapUploadErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={!!target}
      title="Discard draft"
      message={target && (
        <div className="space-y-2">
          <p>
            Discard the draft for <span className="font-medium text-foreground">{target.map_name}</span> from {target.source_archive}?
            {target.publish_id === null
              ? 'Its uploaded files are deleted and this cannot be undone.'
              : 'It leaves the drafts list and its uploaded files are deleted. Its publish history is kept.'}
          </p>
          <Feedback message={error} tone="red" />
        </div>
      )}
      confirmLabel="Discard"
      tone="red"
      busy={busy}
      onConfirm={() => { void discard() }}
      onCancel={onCancel}
    />
  )
}
