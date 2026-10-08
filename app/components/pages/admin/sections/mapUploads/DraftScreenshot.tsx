import { useEffect, useState } from 'react'
import { ImageOff, ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import {
  fetchMapUploadScreenshot, mapUploadErrorMessage, removeMapUploadScreenshot, selectEmbeddedMapUploadScreenshot, uploadMapUploadScreenshot,
} from '@/app/utils/api'
import type { Draft, ScreenshotSource } from '@/app/utils/mapUploadTypes'
import { MapScreenshotModal } from '@/app/components/modals/MapScreenshotModal'
import { cn } from '@/lib/utils'
import { ActionButton } from '../../components/controls'

const SOURCE_LABEL: Record<ScreenshotSource, string> = {
  embedded: 'Taken from the map file',
  upload: 'Uploaded',
  previous: 'Kept from the old version',
  none: 'No screenshot yet',
}

export function useStagedScreenshot(token: string, draft: Draft | null, revision: number): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const source = draft?.screenshot.source ?? 'none'
  const draftId = draft?.id ?? null
  const target = draft?.version.target ?? null

  useEffect(() => {
    setUrl(null)
    if (source === 'none' || draftId === null) return
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

export function ScreenshotTile({ url, className, onClick }: { url: string | null; className?: string; onClick?: () => void }) {
  const content = url
    ? <img src={url} alt="Map screenshot" className="size-full object-cover" />
    : <ImageOff className="size-6 text-muted-foreground/50" />
  const shell = cn('shrink-0 overflow-hidden rounded-xl border border-hairline/10 bg-hairline/[0.03] flex items-center justify-center', className)
  if (!onClick) return <div className={shell}>{content}</div>
  return (
    <button type="button" onClick={onClick} aria-label={url ? 'Replace the screenshot' : 'Add a screenshot'}
      className={cn(shell, 'group relative cursor-pointer transition-colors hover:border-accent-500/50')}>
      {content}
      <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-background/70 text-xs font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <ImagePlus className="size-4" />{url ? 'Replace' : 'Add'}
      </span>
    </button>
  )
}

export function DraftScreenshot({ token, draft, url, onChanged, onDraftChange, onError }: {
  token: string
  draft: Draft
  url: string | null
  onChanged: () => void
  onDraftChange: (draft: Draft) => void
  onError: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [cropping, setCropping] = useState(false)
  const { source, embedded_available: embeddedAvailable } = draft.screenshot

  const apply = (next: Draft) => {
    onDraftChange(next)
    onChanged()
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
    <div className="flex flex-wrap items-center gap-4">
      <ScreenshotTile url={url} className="size-28" onClick={busy ? undefined : () => setCropping(true)} />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">{SOURCE_LABEL[source]}</p>
          <p className="text-xs text-muted-foreground">Square, shown on the map page and in the vote list. Optional, but recommended.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={ImagePlus} disabled={busy} onClick={() => setCropping(true)}>{source === 'none' ? 'Upload' : 'Replace'}</ActionButton>
          {embeddedAvailable && source !== 'embedded' && (
            <ActionButton icon={RotateCcw} loading={busy} onClick={() => { void run(() => selectEmbeddedMapUploadScreenshot(token, draft.id)) }}>Use the map's own</ActionButton>
          )}
          {source !== 'none' && (
            <ActionButton tone="red" icon={Trash2} disabled={busy} onClick={() => { void run(() => removeMapUploadScreenshot(token, draft.id)) }}>Remove</ActionButton>
          )}
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
