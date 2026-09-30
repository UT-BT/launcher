import { useRef, useState, type ChangeEvent } from 'react'
import { Film, Trash2 } from 'lucide-react'
import { deleteMapVideo, uploadMapVideo, type AdminMapRow } from '@/app/utils/api'
import { mapVideoUrl } from '@/app/utils/mapScreenshots'
import { ActionButton, ConfirmDialog, Feedback, errMessage } from '../components/controls'
import { PANEL_LABEL, useResetOnChange } from '../components/shared'
import { MAP_VIDEO_ACCEPT, checkMapVideoFile } from './mapVideoFile'

export interface MapVideoState {
  has: boolean
  version: string | null
}

export function MapVideoControl({ token, mapName, video, onChange }: {
  token: string
  mapName: string
  video: MapVideoState
  onChange: (row: AdminMapRow) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useResetOnChange(() => {
    setBusy(null); setError(null); setConfirming(false)
  }, [mapName])

  const run = async (kind: 'upload' | 'remove', fn: () => Promise<AdminMapRow>) => {
    setBusy(kind); setError(null)
    try {
      onChange(await fn())
      setConfirming(false)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = checkMapVideoFile(file)
    if (problem) {
      setError(problem)
      return
    }
    void run('upload', () => uploadMapVideo(token, mapName, file, file.name))
  }

  return (
    <div className="space-y-1.5" data-testid="map-video-control">
      <label className={PANEL_LABEL}>Fly-through video</label>
      {video.has && (
        <video
          key={video.version ?? 'none'}
          src={mapVideoUrl(mapName, video.version)}
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label={`Fly-through video preview for ${mapName}`}
          className="w-full aspect-video rounded-lg border border-border bg-black"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton tone="accent" icon={Film} loading={busy === 'upload'} disabled={busy !== null} onClick={() => input.current?.click()}>
          {video.has ? 'Replace video' : 'Upload video'}
        </ActionButton>
        {video.has && (
          <ActionButton tone="red" icon={Trash2} disabled={busy !== null} onClick={() => setConfirming(true)}>
            Remove video
          </ActionButton>
        )}
        <span className="text-xs text-muted-foreground">WebM only, up to 150 MB.</span>
      </div>
      <input ref={input} type="file" accept={MAP_VIDEO_ACCEPT} className="hidden" onChange={pick} aria-label="Fly-through video file" />
      <Feedback message={error} tone="red" onDismiss={() => setError(null)} />
      <ConfirmDialog
        open={confirming}
        title="Remove fly-through video"
        message={<>Remove the fly-through video for <span className="font-semibold">{mapName}</span>? Scenes fall back to the screenshot.</>}
        confirmLabel="Remove"
        tone="red"
        busy={busy === 'remove'}
        onConfirm={() => void run('remove', () => deleteMapVideo(token, mapName))}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
