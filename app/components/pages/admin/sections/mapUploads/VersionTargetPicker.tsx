import { useState } from 'react'
import type { Draft, VersionMode } from '@/app/utils/mapUploadTypes'
import { MapSearchInput } from '@/app/components/shared/MapSearchInput'
import { cn } from '@/lib/utils'
import type { DraftFormValues } from './draftFormState'

const MODES: [VersionMode, string, string][] = [
  ['update', 'Update', 'Records, team records, playtime, reviews and favourites move here, and the old map is retired.'],
  ['rework-retire', 'Rework, retire old', 'The old map is retired with its records. This one starts clean.'],
  ['rework-keep-both', 'Rework, keep both', 'Both stay votable, each with its own records.'],
]

export function VersionTargetPicker({ token, draft, values, onChange }: {
  token: string
  draft: Draft
  values: DraftFormValues
  onChange: (change: Partial<Pick<DraftFormValues, 'versionTarget' | 'versionMode'>>) => void
}) {
  const [open, setOpen] = useState(values.versionTarget !== null)
  const shown = open || values.versionTarget !== null

  const toggle = (on: boolean) => {
    setOpen(on)
    if (!on && (values.versionTarget || values.versionMode)) onChange({ versionTarget: null, versionMode: null })
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={shown} onChange={(e) => toggle(e.target.checked)} style={{ colorScheme: 'dark' }} className="size-4 accent-emerald-500 cursor-pointer" />
        <span className="text-sm text-foreground">New version of an existing map</span>
      </label>
      {shown && (
        <div className="space-y-3 pl-6">
          {values.versionTarget === null && draft.version.candidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Suggested:</span>
              {draft.version.candidates.map((name) => (
                <button key={name} type="button" onClick={() => onChange({ versionTarget: name })}
                  className="text-xs font-mono rounded-md border border-hairline/10 px-2 py-1 hover:bg-hairline/5 cursor-pointer break-all">{name}</button>
              ))}
            </div>
          )}
          <MapSearchInput accessToken={token} value={values.versionTarget} onChange={(versionTarget) => onChange({ versionTarget })} placeholder="Search existing maps…" />
          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground mb-1">What happens to the old map</legend>
            {MODES.map(([mode, label, explanation]) => (
              <label key={mode} className={cn('flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer', values.versionMode === mode ? 'border-accent-500/40 bg-accent-500/10' : 'border-hairline/10')}>
                <input type="radio" name={`version-mode-${draft.id}`} checked={values.versionMode === mode} onChange={() => onChange({ versionMode: mode })} style={{ colorScheme: 'dark' }} className="mt-0.5 accent-emerald-500 cursor-pointer" />
                <span className="text-sm text-foreground">{label}<span className="block text-xs text-muted-foreground">{explanation}</span></span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  )
}
