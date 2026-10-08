import { useState, type DragEvent } from 'react'
import { FileArchive, FolderUp, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAP_ARCHIVE_MAX_LABEL } from '@/app/utils/api'
import { ActionButton, Feedback } from '../../components/controls'
import { ARCHIVE_ACCEPT, megabytes, uploadPercent, type UploadState } from './uploadState'
import { countLabel } from './reportLabels'
import { IconTile } from './Panel'

function UploadProgress({ state, onCancel }: { state: Extract<UploadState, { phase: 'uploading' }>; onCancel: () => void }) {
  const percent = uploadPercent(state)
  return (
    <div className="rounded-xl border border-accent-500/30 bg-accent-500/[0.06] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <IconTile icon={FileArchive} />
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-medium text-foreground">{state.fileName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Uploading · {megabytes(state.loaded)} of {megabytes(state.total)}
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums text-accent-200">{percent}%</span>
        <ActionButton tone="red" icon={X} onClick={onCancel}>Cancel</ActionButton>
      </div>
      <div
        role="progressbar"
        aria-label={`Uploading ${state.fileName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-hairline/10"
      >
        <div className="h-full rounded-full bg-accent-500 transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <label
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'group flex cursor-pointer flex-wrap items-center gap-4 rounded-xl border border-dashed px-5 py-5 transition-colors',
        dragging ? 'border-accent-500/70 bg-accent-500/10' : 'border-hairline/15 bg-card/30 hover:border-accent-500/40 hover:bg-card/50',
      )}
    >
      <span className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-xl border transition-colors',
        dragging ? 'border-accent-500/60 bg-accent-500/20 text-accent-200' : 'border-accent-500/30 bg-accent-500/10 text-accent-300',
      )}>
        <UploadCloud className="size-6" />
      </span>
      <span className="min-w-0 flex-1 basis-56">
        <span className="block text-sm font-semibold text-foreground">{dragging ? 'Drop it to upload' : 'Upload a map archive'}</span>
        <span className="block text-xs text-muted-foreground">
          Drag a .zip, .rar or .7z here, up to {MAP_ARCHIVE_MAX_LABEL}. A map pack becomes one draft per map.
        </span>
      </span>
      <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent-500/40 bg-accent-500/15 px-4 text-sm font-medium text-accent-200 transition-colors group-hover:border-accent-500/60 group-hover:bg-accent-500/25">
        <FolderUp className="size-4" />Choose archive
      </span>
      <input
        type="file"
        accept={ARCHIVE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}

export function UploadPanel({ state, onFile, onCancel, onReset }: {
  state: UploadState
  onFile: (file: File) => void
  onCancel: () => void
  onReset: () => void
}) {
  return (
    <section aria-label="Upload a map archive" className="space-y-2">
      {state.phase === 'uploading' ? <UploadProgress state={state} onCancel={onCancel} /> : <DropZone onFile={onFile} />}
      {state.phase === 'error' && <Feedback message={`${state.fileName}: ${state.message}`} tone="red" onDismiss={onReset} />}
      {state.phase === 'done' && (
        <Feedback
          message={`${state.fileName} uploaded into ${countLabel(state.draftIds.length, 'draft')}.`}
          tone="emerald"
          onDismiss={onReset}
        />
      )}
    </section>
  )
}
