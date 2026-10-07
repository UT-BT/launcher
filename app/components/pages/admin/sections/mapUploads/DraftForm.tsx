import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pencil, Send } from 'lucide-react'
import { fetchAdminMapTags, mapUploadErrorMessage, patchMapUploadDraft, publishMapUploadDraft } from '@/app/utils/api'
import type { Draft } from '@/app/utils/mapUploadTypes'
import { Input } from '@/app/components/ui/input'
import { ActionButton, AdminSelect, ConfirmDialog, Feedback } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { AuthorPicker } from '../../components/AuthorPicker'
import { TagEditor } from '../../components/TagEditor'
import type { DraftFormProps } from './handover'
import { BLOCK_TITLE } from './reportLabels'
import {
  createDraftAutosave, formValuesFromDraft, hasCodePackage, nameBlocks, publishGate, publishNextStep, publishOutcome,
  requiredPlayersMismatch, suggestMapName, type DraftAutosave, type DraftAutosaveState, type DraftFormValues,
} from './draftFormState'
import { DraftScreenshot } from './DraftScreenshot'
import { VersionTargetPicker } from './VersionTargetPicker'

const numberOptions = (count: number) => Array.from({ length: count }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
const DIFFICULTY_OPTIONS = numberOptions(10)
const PLAYER_OPTIONS = numberOptions(12)

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <span className={PANEL_LABEL}>{label}</span>
      {children}
    </div>
  )
}

function useDraftAutosave(token: string, draft: Draft, onDraftChange: (draft: Draft) => void, onError: (message: string) => void) {
  const [form, setForm] = useState<DraftAutosaveState>(() => ({ values: formValuesFromDraft(draft), saving: false }))
  const autosaveRef = useRef<DraftAutosave | null>(null)
  const latest = useRef({ draft, onDraftChange, onError })
  useEffect(() => { latest.current = { draft, onDraftChange, onError } })
  const draftId = draft.id

  useEffect(() => {
    const autosave = createDraftAutosave({
      initial: formValuesFromDraft(latest.current.draft),
      save: (patch) => patchMapUploadDraft(token, draftId, patch),
      onSaved: (saved) => latest.current.onDraftChange(saved),
      onError: (e) => latest.current.onError(mapUploadErrorMessage(e)),
      onState: setForm,
    })
    autosaveRef.current = autosave
    return () => {
      autosave.dispose()
      autosaveRef.current = null
    }
  }, [token, draftId])

  useEffect(() => { autosaveRef.current?.sync(draft) }, [draft])

  const edit = (change: Partial<DraftFormValues>, debounce = false) => autosaveRef.current?.edit(change, { debounce })
  const flush = async () => (await autosaveRef.current?.flush()) ?? null
  return { ...form, edit, flush }
}

function MapNameField({ draft, renaming, onRename }: { draft: Draft; renaming: boolean; onRename: (name: string) => void }) {
  const blocks = nameBlocks(draft)
  const [name, setName] = useState(() => suggestMapName(draft.map_name))
  const next = name.trim()
  if (blocks.length === 0) return null

  return (
    <Field label="Map name">
      <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 space-y-2 text-red-200">
        {blocks.map((block, i) => (
          <p key={`${block.code}-${i}`} className="text-sm">{BLOCK_TITLE[block.code]}.</p>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="New map name" className="h-8 flex-1 min-w-48 font-mono" />
          <ActionButton icon={Pencil} loading={renaming} disabled={!next || next === draft.map_name} onClick={() => onRename(next)}>Rename</ActionButton>
        </div>
      </div>
    </Field>
  )
}

function DraftEditor({ token, draft, onDraftChange, onPublished }: DraftFormProps) {
  const [feedback, setFeedback] = useState<{ message: string; tone: 'red' | 'amber' } | null>(null)
  const [busy, setBusy] = useState<'rename' | 'publish' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const showError = (message: string) => setFeedback({ message, tone: 'red' })
  const { values, saving, edit, flush } = useDraftAutosave(token, draft, onDraftChange, showError)
  const gate = publishGate(draft)

  useEffect(() => {
    fetchAdminMapTags(token).then(setTagSuggestions).catch(() => {})
  }, [token])

  const run = async (kind: 'rename' | 'publish', action: () => Promise<void>) => {
    setBusy(kind); setFeedback(null); setConfirming(false)
    try {
      await action()
    } catch (e) {
      showError(mapUploadErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const rename = (name: string) => run('rename', async () => {
    await flush()
    onDraftChange(await patchMapUploadDraft(token, draft.id, { map_name: name }))
  })

  const publish = async () => {
    const outcome = publishOutcome(await publishMapUploadDraft(token, draft.id))
    if (outcome.kind === 'open') return onPublished(outcome.publishId)
    onDraftChange(outcome.draft)
    setFeedback({ message: outcome.message, tone: 'amber' })
  }

  const startPublish = () => run('publish', async () => {
    const step = publishNextStep((await flush()) ?? draft)
    if (step === 'confirm-no-screenshot') setConfirming(true)
    else if (step === 'publish') await publish()
  })

  return (
    <section aria-label="Draft details" className="rounded-lg border border-hairline/10 bg-card/30 p-4 space-y-4">
      <MapNameField key={draft.map_name} draft={draft} renaming={busy === 'rename'} onRename={(name) => { void rename(name) }} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Author">
          <AuthorPicker
            mode={values.authorMode}
            setMode={(authorMode) => edit({ authorMode })}
            authorStr={values.authorStr}
            setAuthorStr={(authorStr) => edit({ authorStr }, true)}
            authorUser={values.authorUser}
            setAuthorUser={(authorUser) => edit({ authorUser })}
            token={token}
          />
        </Field>
        <Field label="Tags">
          <TagEditor tags={values.tags} onChange={(tags) => edit({ tags })} suggestions={tagSuggestions} />
        </Field>
      </div>

      <div className="grid gap-4 grid-cols-2 md:max-w-md">
        <Field label="Difficulty">
          <AdminSelect value={values.difficulty === null ? '' : String(values.difficulty)} onChange={(v) => edit({ difficulty: v ? Number(v) : null })}
            options={DIFFICULTY_OPTIONS} placeholder="Not set" ariaLabel="Difficulty" className="w-full" />
        </Field>
        <Field label="Required players">
          <AdminSelect value={values.requiredPlayers === null ? '' : String(values.requiredPlayers)} onChange={(v) => edit({ requiredPlayers: Number(v) })}
            options={PLAYER_OPTIONS} placeholder="Not set" ariaLabel="Required players" className="w-full" />
        </Field>
      </div>
      {requiredPlayersMismatch(values, draft) && (
        <p className="text-xs text-amber-300">The map name suggests {draft.metadata.required_players_suggested}.</p>
      )}

      <Field label="Changelog">
        <Input value={values.changelog} onChange={(e) => edit({ changelog: e.target.value }, true)} placeholder="What is new in this map or version" aria-label="Changelog" className="h-9" />
      </Field>

      <DraftScreenshot token={token} draft={draft} onDraftChange={onDraftChange} onError={showError} />

      <VersionTargetPicker token={token} draft={draft} values={values} onChange={(change) => edit(change)} />

      {hasCodePackage(draft) && (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={values.codePackageAcknowledged} onChange={(e) => edit({ codePackageAcknowledged: e.target.checked })}
            style={{ colorScheme: 'dark' }} className="size-4 mt-0.5 accent-amber-500 cursor-pointer" />
          <span className="text-sm text-amber-100">I reviewed this code package</span>
        </label>
      )}

      <div className="space-y-3 border-t border-hairline/10 pt-4">
        <Feedback message={feedback?.message ?? null} tone={feedback?.tone} onDismiss={() => setFeedback(null)} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">{saving ? 'Saving…' : gate.reason}</span>
          <ActionButton tone="emerald" icon={Send} loading={busy === 'publish'} disabled={!gate.enabled} onClick={() => { void startPublish() }}>Publish</ActionButton>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Publish without a screenshot"
        message={`${draft.map_name} has no screenshot. Publish it anyway?`}
        confirmLabel="Publish"
        busy={busy === 'publish'}
        onConfirm={() => { void run('publish', publish) }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  )
}

export function DraftForm(props: DraftFormProps) {
  return props.draft.status === 'published' ? null : <DraftEditor {...props} />
}
