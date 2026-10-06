import { useState, type DragEvent } from 'react'
import { FileArchive, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAP_ARCHIVE_MAX_MB } from '@/app/utils/api'
import { ActionButton, Feedback } from '../../components/controls'
import { ARCHIVE_ACCEPT, megabytes, uploadPercent, type UploadState } from './uploadState'
import { countLabel } from './reportLabels'

function UploadProgress({ state, onCancel }: { state: Extract<UploadState, { phase: 'uploading' }>; onCancel: () => void }) {
  const percent = uploadPercent(state)
  return (
    <div className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
          <FileArchive className="size-4 shrink-0 text-accent-300" />
          <span className="break-all">{state.fileName}</span>
        </span>
        <ActionButton tone="red" icon={X} onClick={onCancel}>Cancel</ActionButton>
      </div>
      <div
        role="progressbar"
        aria-label={`Uploading ${state.fileName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 rounded-full bg-hairline/10 overflow-hidden"
      >
        <div className="h-full bg-accent-500 transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {percent}% · {megabytes(state.loaded)} of {megabytes(state.total)}
      </p>
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
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center cursor-pointer transition-colors',
        dragging ? 'border-accent-500/60 bg-accent-500/10' : 'border-hairline/20 bg-card/30 hover:border-hairline/30',
      )}
    >
      <Upload className="size-6 text-accent-300" />
      <span className="text-sm text-foreground">Drop a map archive here, or click to choose one</span>
      <span className="text-xs text-muted-foreground">.zip, .rar or .7z, up to {MAP_ARCHIVE_MAX_MB} MB. A map pack becomes one draft per map.</span>
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
