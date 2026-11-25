import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import type {
  AdminOperationsServer,
  AdminServerConfig,
  ServerConfigApplyChoice,
  ServerConfigChange,
  ServerConfigColor,
  ServerConfigKeyId,
  ServerRuleset,
} from '@/app/utils/api'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ConfirmDialog, Feedback, errMessage } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { playerCountText } from '../serverControl'
import { fetchServerConfig, saveServerConfig, serverConfigFieldErrors } from './serverConfigApi'
import {
  SETTING_SPECS,
  canApplyNow,
  initialDraft,
  isSettingId,
  pushesSettings,
  reasonRequired,
  saveOutcome,
  settingsChange,
  settingsErrors,
  settingsView,
  teamRunText,
  type DraftValue,
  type SettingField,
  type SettingMode,
  type SettingsDraft,
} from './serverSettings'

const RULESET_LABEL: Record<ServerRuleset, string> = { casual: 'Casual', certified: 'Certified' }

const RULESETS: ServerRuleset[] = ['casual', 'certified']

const NOT_MANAGED_NOTICE = 'This server is not managed yet; only the ruleset and region can change'

const CONTROL = 'h-9 touch:h-11'

export interface ServerSettingsSaved {
  message: string
  failed: boolean
}

function toHex(color: ServerConfigColor): string {
  return `#${[color.r, color.g, color.b].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

function fromHex(hex: string, alpha: number): ServerConfigColor {
  const part = (start: number) => parseInt(hex.slice(start, start + 2), 16)
  return { r: part(1), g: part(3), b: part(5), a: alpha }
}

function RulesetControl({ value, disabled, onChange }: { value: ServerRuleset; disabled: boolean; onChange: (next: ServerRuleset) => void }) {
  const name = useId()
  return (
    <fieldset className="space-y-1.5">
      <legend className={PANEL_LABEL}>Ruleset</legend>
      <div className="flex gap-2">
        {RULESETS.map((option) => (
          <label
            key={option}
            className={cn(
              CONTROL,
              'flex flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              value === option
                ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                : 'border-hairline/10 bg-card/30 text-muted-foreground hover:text-foreground',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              disabled={disabled}
              onChange={() => onChange(option)}
              style={{ colorScheme: 'dark' }}
            />
            {RULESET_LABEL[option]}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Certified sets max players, boosted caps and player collisions. A ruleset change applies at the next map.
      </p>
    </fieldset>
  )
}

function SettingSwitch({ id, label, checked, disabled, describedBy, hint, onChange }: {
  id: string
  label: string
  checked: boolean
  disabled: boolean
  describedBy: string | undefined
  hint: ReactNode
  onChange: (next: boolean) => void
}) {
  return (
    <div className="min-w-0 space-y-1">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-hairline/10 bg-card/30 px-3 text-left text-sm',
          'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span className="min-w-0">{label}</span>
        <span
          aria-hidden
          className={cn(
            'relative inline-flex h-6 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
            checked ? 'bg-primary' : 'bg-muted',
          )}
        >
          <span className={cn('h-5 w-5 rounded-full bg-background shadow-lg transition-transform', checked ? 'translate-x-6' : 'translate-x-0')} />
        </span>
      </button>
      {hint}
    </div>
  )
}

function FieldHint({ id, mode, error, hint }: { id: string; mode: SettingMode; error: string | undefined; hint: string | undefined }) {
  if (error) return <p id={id} className="text-xs text-red-300">{error}</p>
  if (mode === 'locked') {
    return (
      <p id={id} className="flex items-center gap-1.5 text-xs text-amber-300">
        <Lock className="size-3" />Set by certified
      </p>
    )
  }
  if (hint) return <p id={id} className="text-xs text-muted-foreground">{hint}</p>
  return null
}

function SettingInput({ field, value, error, onChange }: {
  field: SettingField
  value: DraftValue
  error: string | undefined
  onChange: (value: DraftValue) => void
}) {
  const baseId = useId()
  const [revealed, setRevealed] = useState(false)
  const spec = SETTING_SPECS[field.id]
  const disabled = field.mode !== 'editable'
  const inputId = `${baseId}-input`
  const hintId = `${baseId}-hint`
  const hint = <FieldHint id={hintId} mode={field.mode} error={error} hint={spec.kind === 'number' ? spec.hint : undefined} />
  const described = error || field.mode === 'locked' || (spec.kind === 'number' && spec.hint) ? hintId : undefined

  if (spec.kind === 'bool') {
    return (
      <SettingSwitch id={inputId} label={spec.label} checked={value === true} disabled={disabled} describedBy={described} hint={hint} onChange={onChange} />
    )
  }

  const shared = {
    id: inputId,
    disabled,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described,
  }

  let control: ReactNode
  if (spec.kind === 'color' && typeof value === 'object') {
    control = (
      <div className="flex items-center gap-3">
        <input
          {...shared}
          type="color"
          value={toHex(value)}
          onChange={(e) => onChange(fromHex(e.target.value, value.a))}
          style={{ colorScheme: 'dark' }}
          className={cn(CONTROL, 'w-16 cursor-pointer rounded-md border border-hairline/10 bg-card/30 disabled:cursor-not-allowed disabled:opacity-50')}
        />
        <span className="font-mono text-xs text-muted-foreground">{toHex(value)}</span>
      </div>
    )
  } else if (spec.kind === 'number') {
    control = (
      <Input
        {...shared}
        type="number"
        inputMode="numeric"
        min={spec.min}
        max={spec.max}
        step={1}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL}
      />
    )
  } else if (spec.kind === 'password') {
    control = (
      <div className="flex items-center gap-2">
        <Input
          {...shared}
          type={revealed ? 'text' : 'password'}
          autoComplete="off"
          maxLength={spec.maxLength}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={cn(CONTROL, 'flex-1')}
        />
        <Button
          type="button"
          variant="outline"
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          onClick={() => setRevealed((shown) => !shown)}
          className="touch:h-11"
        >
          {revealed ? <EyeOff /> : <Eye />}
          {revealed ? 'Hide' : 'Show'}
        </Button>
      </div>
    )
  } else if (spec.kind !== 'color') {
    control = (
      <Input
        {...shared}
        type="text"
        maxLength={spec.maxLength}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CONTROL, spec.kind === 'map' && 'font-mono')}
      />
    )
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={inputId} className={PANEL_LABEL}>{spec.label}</label>
      {control}
      {hint}
    </div>
  )
}

function SettingsGroup({ label, fields, later, valueOf, errors, onChange }: {
  label: string
  fields: SettingField[]
  later: SettingField[]
  valueOf: (field: SettingField) => DraftValue
  errors: Partial<Record<ServerConfigKeyId, string>>
  onChange: (id: ServerConfigKeyId, value: DraftValue) => void
}) {
  const headingId = useId()
  const grid = (items: SettingField[]) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((field) => (
        <SettingInput key={field.id} field={field} value={valueOf(field)} error={errors[field.id]} onChange={(value) => onChange(field.id, value)} />
      ))}
    </div>
  )
  return (
    <section aria-labelledby={headingId} className="space-y-3 border-t border-hairline/10 pt-4">
      <h4 id={headingId} className="text-xs font-semibold text-foreground">{label}</h4>
      {fields.length > 0 && grid(fields)}
      {later.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Available after cutover</p>
          <div className="opacity-50">{grid(later)}</div>
        </div>
      )}
    </section>
  )
}

function SaveSummary({ server, config, draft, changes, pushes, role, apply, onApply }: {
  server: AdminOperationsServer
  config: AdminServerConfig
  draft: SettingsDraft
  changes: ServerConfigChange['changes']
  pushes: boolean
  role: number | undefined
  apply: ServerConfigApplyChoice
  onApply: (choice: ServerConfigApplyChoice) => void
}) {
  const rulesetChange = reasonRequired(config, draft)
  const labels = Object.keys(changes)
    .filter(isSettingId)
    .map((id) => SETTING_SPECS[id].label)
  const choices: { value: ServerConfigApplyChoice; label: string }[] = [
    { value: 'when_empty', label: 'Apply when the server is empty' },
    ...(canApplyNow(role) ? [{ value: 'now' as const, label: 'Apply now (restarts the server)' }] : []),
  ]
  return (
    <div className="space-y-2">
      <p>
        <span className="font-medium text-foreground">{server.name}</span> · {playerCountText(server.probe)}
      </p>
      {rulesetChange && (
        <p>Ruleset: {RULESET_LABEL[config.ruleset]} to {RULESET_LABEL[draft.ruleset]}. {teamRunText(server.ruleset)}.</p>
      )}
      {labels.length > 0 && <p>Changing: {labels.join(', ')}.</p>}
      {pushes ? (
        <fieldset className="space-y-1.5">
          <legend className={PANEL_LABEL}>When to apply</legend>
          {choices.map((choice) => (
            <label key={choice.value} className="flex min-h-11 items-center gap-2 rounded-md border border-hairline/10 bg-card/30 px-3 text-sm text-foreground cursor-pointer">
              <input
                type="radio"
                name="server-settings-apply"
                value={choice.value}
                checked={apply === choice.value}
                onChange={() => onApply(choice.value)}
                style={{ colorScheme: 'dark' }}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <p>{rulesetChange ? 'The new ruleset applies at the next map, with no restart.' : 'No restart is needed.'}</p>
      )}
    </div>
  )
}

export function ServerSettingsDialog({ server, token, role, onClose, onSaved }: {
  server: AdminOperationsServer
  token: string
  role: number | undefined
  onClose: () => void
  onSaved: (saved: ServerSettingsSaved) => void
}) {
  const [config, setConfig] = useState<AdminServerConfig | null>(null)
  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [serverErrors, setServerErrors] = useState<Partial<Record<ServerConfigKeyId, string>>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [apply, setApply] = useState<ServerConfigApplyChoice>('when_empty')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchServerConfig(token, server.id, controller.signal)
      .then((next) => {
        setConfig(next)
        setDraft(initialDraft(next))
        setLoadError(null)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(errMessage(e))
      })
    return () => controller.abort()
  }, [token, server.id, attempt])

  const saved = useMemo(() => (config ? initialDraft(config) : null), [config])
  const view = config && draft ? settingsView(config, draft, role) : null
  const changes = config && draft ? settingsChange(config, draft, role) : {}
  const clientErrors = config && draft ? settingsErrors(config, draft, role) : {}
  const errors = { ...serverErrors, ...clientErrors }
  const changed = Object.keys(changes).length > 0
  const blocked = Object.keys(clientErrors).length > 0
  const pushes = pushesSettings(changes)
  const rulesetChange = !!config && !!draft && reasonRequired(config, draft)

  const valueOf = (field: SettingField): DraftValue => {
    const source = field.mode === 'editable' ? draft : saved
    return source?.values[field.id] ?? ''
  }

  const edit = (id: ServerConfigKeyId, value: DraftValue) => {
    setDraft((current) => (current ? { ...current, values: { ...current.values, [id]: value } } : current))
    setServerErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))
  }

  const openConfirm = () => {
    setApply('when_empty')
    setSaveError(null)
    setConfirming(true)
  }

  const save = async (reason?: string) => {
    if (!config || !draft) return
    const body: ServerConfigChange = {
      changes,
      ...(pushes ? { apply } : {}),
      ...(rulesetChange ? { reason } : {}),
    }
    setSaving(true)
    try {
      const outcome = await saveServerConfig(token, server.id, body, role)
      if (outcome.ok) {
        onSaved(saveOutcome(outcome.result, changes))
        return
      }
      setServerErrors(serverConfigFieldErrors(outcome.failure))
      setSaveError(outcome.failure.message || 'The server refused the change.')
    } catch (e) {
      setSaveError(errMessage(e))
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeOnBackdrop={false}
      title="Server settings"
      offsetSidebar
      maxWidth="44rem"
      footer={
        <div className="p-4 border-t border-border bg-muted/50 space-y-3">
          <Feedback message={saveError} tone="red" onDismiss={() => setSaveError(null)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving} className="touch:h-11">Cancel</Button>
            <Button onClick={openConfirm} disabled={!changed || blocked || saving} className="touch:h-11">Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="min-w-0">
          <div className="font-medium truncate">{server.name}</div>
          {config?.version != null && <div className="text-xs text-muted-foreground">Config version {config.version}</div>}
        </div>

        {loadError && (
          <div className="space-y-2">
            <Feedback message={loadError} tone="red" />
            <Button variant="outline" onClick={() => { setLoadError(null); setAttempt((n) => n + 1) }} className="touch:h-11">Try again</Button>
          </div>
        )}
        {!config && !loadError && (
          <div role="status" aria-label="Loading settings" className="flex justify-center py-8">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        )}

        {config && draft && view && (
          <>
            {view.notManaged && <Feedback message={NOT_MANAGED_NOTICE} tone="amber" />}
            {view.roleNotice && <Feedback message={view.roleNotice} />}

            <RulesetControl
              value={draft.ruleset}
              disabled={!view.rulesetEditable}
              onChange={(ruleset) => setDraft((current) => (current ? { ...current, ruleset } : current))}
            />

            {view.groups.map((group) => (
              <SettingsGroup
                key={group.id}
                label={group.label}
                fields={group.fields}
                later={group.later}
                valueOf={valueOf}
                errors={errors}
                onChange={edit}
              />
            ))}
          </>
        )}
      </div>

      {config && draft && (
        <ConfirmDialog
          open={confirming}
          title="Save settings"
          message={
            <SaveSummary
              server={server}
              config={config}
              draft={draft}
              changes={changes}
              pushes={pushes}
              role={role}
              apply={apply}
              onApply={setApply}
            />
          }
          confirmLabel="Save"
          busy={saving}
          withReason={rulesetChange}
          reasonRequired={rulesetChange}
          reasonPlaceholder="Why the ruleset changes"
          onConfirm={save}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Modal>
  )
}
