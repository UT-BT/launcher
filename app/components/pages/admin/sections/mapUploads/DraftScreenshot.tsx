import { useEffect, useState } from 'react'
import { ImageOff, ImagePlus, RotateCcw } from 'lucide-react'
import {
  fetchMapUploadScreenshot, mapUploadErrorMessage, removeMapUploadScreenshot, selectEmbeddedMapUploadScreenshot, uploadMapUploadScreenshot,
} from '@/app/utils/api'
import type { Draft, ScreenshotSource } from '@/app/utils/mapUploadTypes'
import { MapScreenshotModal } from '@/app/components/modals/MapScreenshotModal'
import { ActionButton } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'

const SOURCE_LABEL: Record<ScreenshotSource, string> = {
  embedded: 'Embedded in the map',
  upload: 'Uploaded',
  previous: 'From the old version',
  none: 'No screenshot',
}

function useStagedImage(token: string, draft: Draft, revision: number): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const source = draft.screenshot.source
  const draftId = draft.id
  const target = draft.version.target

  useEffect(() => {
    setUrl(null)
    if (source === 'none') return
    const ctrl = new AbortController()
    let objectUrl: string | null = null
    fetchMapUploadScreenshot(token, draftId, 'staged', ctrl.signal)
      .then((image) => {
        if (!image || ctrl.signal.aborted) return
        objectUrl = URL.createObjectURL(image)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      ctrl.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [token, draftId, source, target, revision])

  return url
}

export function DraftScreenshot({ token, draft, onDraftChange, onError }: {
  token: string
  draft: Draft
  onDraftChange: (draft: Draft) => void
  onError: (message: string) => void
}) {
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState(false)
  const url = useStagedImage(token, draft, revision)
  const { source, embedded_available: embeddedAvailable } = draft.screenshot

  const apply = (next: Draft) => {
    onDraftChange(next)
    setRevision((r) => r + 1)
  }

  const run = async (action: () => Promise<Draft>) => {
    setBusy(true)
    try {
      apply(await action())
    } catch (e) {
      onError(mapUploadErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <span className={PANEL_LABEL}>Screenshot</span>
      <div className="flex flex-wrap items-start gap-4">
        <div className="size-32 shrink-0 rounded-md border border-hairline/10 bg-card/30 overflow-hidden flex items-center justify-center">
          {url ? <img src={url} alt="Screenshot" className="size-full object-cover" /> : <ImageOff className="size-6 text-muted-foreground/60" />}
        </div>
        <div className="space-y-2 min-w-0">
          <p className="text-sm text-foreground">{SOURCE_LABEL[source]}</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={ImagePlus} disabled={busy} onClick={() => setCropping(true)}>{source === 'none' ? 'Upload' : 'Replace'}</ActionButton>
            {embeddedAvailable && source !== 'embedded' && (
              <ActionButton icon={RotateCcw} loading={busy} onClick={() => { void run(() => selectEmbeddedMapUploadScreenshot(token, draft.id)) }}>Use embedded</ActionButton>
            )}
            {source !== 'none' && (
              <ActionButton tone="red" icon={ImageOff} disabled={busy} onClick={() => { void run(() => removeMapUploadScreenshot(token, draft.id)) }}>Remove</ActionButton>
            )}
          </div>
        </div>
      </div>
      <MapScreenshotModal
        open={cropping}
        onClose={() => setCropping(false)}
        mapName={draft.map_name}
        previewUrl={url}
        onCropped={async (image, filename) => {
          try {
            apply(await uploadMapUploadScreenshot(token, draft.id, image, filename))
          } catch (e) {
            throw new Error(mapUploadErrorMessage(e))
          }
        }}
      />
    </div>
  )
}
