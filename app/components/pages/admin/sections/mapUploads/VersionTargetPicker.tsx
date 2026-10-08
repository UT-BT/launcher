import { useState } from 'react'
import { Archive, Copy, RefreshCw, type LucideIcon } from 'lucide-react'
import type { Draft, VersionMode } from '@/app/utils/mapUploadTypes'
import { MapSearchInput } from '@/app/components/shared/MapSearchInput'
import { Switch } from '@/app/components/ui/switch'
import { cn } from '@/lib/utils'
import type { DraftFormValues } from './draftFormState'

const MODES: { mode: VersionMode; label: string; explanation: string; icon: LucideIcon }[] = [
  { mode: 'update', label: 'Update', icon: RefreshCw, explanation: 'Records, team records, playtime, reviews and favourites move here, and the old map is retired.' },
  { mode: 'rework-retire', label: 'Rework, retire old', icon: Archive, explanation: 'The old map is retired with its records. This one starts clean.' },
  { mode: 'rework-keep-both', label: 'Rework, keep both', icon: Copy, explanation: 'Both stay votable, each with its own records.' },
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
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">New version of an existing map</span>
          <span className="block text-xs text-muted-foreground">Off: this is a brand new map.</span>
        </span>
        <Switch checked={shown} onCheckedChange={toggle} aria-label="New version of an existing map" />
      </label>
      {shown && (
        <div className="space-y-3 rounded-lg border border-hairline/5 bg-hairline/[0.02] p-3">
          {values.versionTarget === null && draft.version.candidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Looks like:</span>
              {draft.version.candidates.map((name) => (
                <button key={name} type="button" onClick={() => onChange({ versionTarget: name })}
                  className="rounded-md border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 font-mono text-xs text-accent-200 hover:bg-accent-500/20 cursor-pointer break-all">{name}</button>
              ))}
            </div>
          )}
          <MapSearchInput accessToken={token} value={values.versionTarget} onChange={(versionTarget) => onChange({ versionTarget })} placeholder="Search existing maps…" />
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">What happens to the old map</legend>
            <div className="grid gap-2 @3xl/draft:grid-cols-3">
              {MODES.map(({ mode, label, explanation, icon: Icon }) => {
                const selected = values.versionMode === mode
                return (
                  <label key={mode} className={cn(
                    'relative flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2.5 transition-colors',
                    selected ? 'border-accent-500/50 bg-accent-500/10' : 'border-hairline/10 hover:border-hairline/20 hover:bg-hairline/[0.03]',
                  )}>
                    <input type="radio" name={`version-mode-${draft.id}`} checked={selected} onChange={() => onChange({ versionMode: mode })} className="sr-only" />
                    <span className={cn('flex items-center gap-2 text-sm font-medium', selected ? 'text-accent-200' : 'text-foreground')}>
                      <Icon className="size-3.5" />{label}
                    </span>
                    <span className="text-xs leading-snug text-muted-foreground">{explanation}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}
