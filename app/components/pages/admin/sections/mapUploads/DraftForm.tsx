import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Check, CheckCircle2, Circle, Loader2, OctagonX, PenLine, Pencil, Rocket, Send, type LucideIcon,
} from 'lucide-react'
import { fetchAdminMapTags, mapUploadErrorMessage, patchMapUploadDraft, publishMapUploadDraft } from '@/app/utils/api'
import type { Draft } from '@/app/utils/mapUploadTypes'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/lib/utils'
import { ActionButton, AdminSelect, ConfirmDialog, Feedback } from '../../components/controls'
import { PANEL_LABEL } from '../../components/shared'
import { AuthorModeToggle, AuthorPicker } from '../../components/AuthorPicker'
import { TagEditor } from '../../components/TagEditor'
import type { DraftWorkspaceProps } from './handover'
import { BLOCK_TITLE } from './reportLabels'
import {
  createDraftAutosave, formValuesFromDraft, hasAuthor, hasCodePackage, hasMapTitle, nameBlocks, publishGate, publishNextStep, publishOutcome,
  requiredPlayersMismatch, suggestMapName, type DraftAutosave, type DraftAutosaveState, type DraftFormValues, type PublishGate,
} from './draftFormState'
import { draftFieldId, readinessItems, scrollToDraftField, type DraftField, type ReadinessItem, type ReadinessState } from './reportView'
import { DraftScreenshot } from './DraftScreenshot'
import { VersionTargetPicker } from './VersionTargetPicker'
import { IconTile, MonoChip, Panel } from './Panel'

const numberOptions = (count: number) => Array.from({ length: count }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
const DIFFICULTY_OPTIONS = numberOptions(10)
const PLAYER_OPTIONS = numberOptions(12)

function RequiredMark() {
  return <span aria-hidden className="ml-0.5 text-red-300">*</span>
}

function OptionalMark() {
  return <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/60">optional</span>
}

function Field({ label, required, optional, aside, hint, children }: {
  label: string
  required?: boolean
  optional?: boolean
  aside?: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex h-7 items-center justify-between gap-2">
        <span className={PANEL_LABEL}>
          {label}{required && <RequiredMark />}{optional && <OptionalMark />}
          {required && <span className="sr-only"> (required)</span>}
        </span>
        {aside}
      </div>
      {children}
      {hint}
    </div>
  )
}

function FormSection({ id, title, description, optional, children }: {
  id?: string
  title: string
  description?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div id={id} className="scroll-mt-4 space-y-3 px-4 py-4">
      <div>
        <h4 className="text-xs font-semibold text-foreground">
          {title}{optional && <span className="ml-1.5 font-normal text-muted-foreground/60">optional</span>}
        </h4>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
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

function MapNameFix({ draft, renaming, onRename }: { draft: Draft; renaming: boolean; onRename: (name: string) => void }) {
  const blocks = nameBlocks(draft)
  const [name, setName] = useState(() => suggestMapName(draft.map_name))
  const next = name.trim()
  const titled = hasMapTitle(next)
  if (blocks.length === 0) return null

  return (
    <FormSection id={draftFieldId(draft.id, 'name')} title="Map name" description="The map file is renamed when you publish. The name is what players vote for.">
      <div className="space-y-2.5 rounded-lg border border-red-500/30 bg-red-500/[0.07] p-3">
        <ul className="space-y-1">
          {blocks.map((block, i) => (
            <li key={`${block.code}-${i}`} className="flex items-start gap-2 text-sm text-red-200">
              <OctagonX className="mt-0.5 size-3.5 shrink-0" />{BLOCK_TITLE[block.code]}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="New map name" aria-invalid={!titled || undefined}
            className="h-9 min-w-48 flex-1 font-mono" />
          <ActionButton icon={Pencil} loading={renaming} disabled={!next || !titled || next === draft.map_name} onClick={() => onRename(next)}>Rename</ActionButton>
        </div>
        {!titled && <p className="text-xs text-red-300">Add the map's own name after the prefix, with at least one letter.</p>}
      </div>
    </FormSection>
  )
}

function CodeReview({ draft, acknowledged, onChange }: { draft: Draft; acknowledged: boolean; onChange: (value: boolean) => void }) {
  const codeFiles = draft.files.filter((file) => file.kind === 'code' && file.disposition !== 'dropped')
  return (
    <FormSection id={draftFieldId(draft.id, 'code')} title="Code package" description="Code runs on every server and every player's game. Check it comes from someone you trust.">
      <label className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        acknowledged ? 'border-emerald-500/30 bg-emerald-500/[0.07]' : 'border-amber-500/30 bg-amber-500/[0.07]',
      )}>
        <input type="checkbox" checked={acknowledged} onChange={(e) => onChange(e.target.checked)} style={{ colorScheme: 'dark' }}
          className={cn('mt-0.5 size-4 cursor-pointer', acknowledged ? 'accent-emerald-500' : 'accent-amber-500')} />
        <span className="min-w-0 space-y-1.5">
          <span className={cn('block text-sm font-medium', acknowledged ? 'text-emerald-200' : 'text-amber-100')}>I reviewed the code in this archive</span>
          {codeFiles.length > 0 && (
            <span className="flex flex-wrap gap-1">{codeFiles.map((file) => <MonoChip key={file.file}>{file.file}</MonoChip>)}</span>
          )}
        </span>
      </label>
    </FormSection>
  )
}

const READINESS_ICON: Record<ReadinessState, { icon: LucideIcon; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-emerald-300' },
  todo: { icon: OctagonX, className: 'text-red-300' },
  warn: { icon: AlertTriangle, className: 'text-amber-300' },
  optional: { icon: Circle, className: 'text-muted-foreground/60' },
}

function ReadinessList({ items, onJump }: { items: ReadinessItem[]; onJump: (field: DraftField) => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const { icon: Icon, className } = READINESS_ICON[item.state]
        const field = item.field
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!field}
              onClick={() => field && onJump(field)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs text-foreground/90 hover:bg-hairline/5 cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
            >
              <Icon className={cn('size-3.5 shrink-0', className)} />
              <span className={cn('min-w-0 flex-1 break-words', item.state === 'optional' && 'text-muted-foreground')}>{item.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function headline(draft: Draft, gate: PublishGate): { title: string; tone: 'red' | 'amber' | 'emerald' | 'accent'; icon: LucideIcon } {
  if (draft.status === 'analyzing') return { title: 'Checking the archive', tone: 'accent', icon: Loader2 }
  if (draft.blocks.length > 0) return { title: 'Not ready to publish', tone: 'red', icon: OctagonX }
  if (!gate.enabled) return { title: 'Almost ready', tone: 'amber', icon: AlertTriangle }
  if (draft.warnings.length > 0) return { title: 'Ready, with warnings', tone: 'amber', icon: AlertTriangle }
  return { title: 'Ready to publish', tone: 'emerald', icon: Rocket }
}

function publishStatus(draft: Draft, gate: PublishGate, items: ReadinessItem[], saving: boolean): string {
  if (saving) return 'Saving…'
  if (draft.status === 'analyzing') return 'This updates by itself.'
  const todo = items.find((item) => item.state === 'todo')
  if (todo) return todo.label
  return gate.reason ?? 'Every host installs the files, then the map goes live by itself.'
}

function wideStatus(draft: Draft, gate: PublishGate): string {
  if (draft.status === 'analyzing') return 'This updates by itself.'
  if (gate.enabled) return 'Every host installs it, then it goes live.'
  return 'Work through the list below.'
}

function PublishPanel({ draft, values, gate, saving, busy, feedback, onDismissFeedback, onPublish, onJump }: {
  draft: Draft
  values: DraftFormValues
  gate: PublishGate
  saving: boolean
  busy: boolean
  feedback: { message: string; tone: 'red' | 'amber' } | null
  onDismissFeedback: () => void
  onPublish: () => void
  onJump: (field: DraftField) => void
}) {
  const head = headline(draft, gate)
  const items = readinessItems(draft, values)
  const status = publishStatus(draft, gate, items, saving)
  return (
    <aside
      aria-label="Publish"
      className={cn(
        'sticky bottom-3 z-10 rounded-xl border border-hairline/10 bg-card shadow-lg shadow-black/30',
        '@5xl/draft:top-4 @5xl/draft:bottom-auto @5xl/draft:bg-card/30 @5xl/draft:border-hairline/5 @5xl/draft:shadow-none',
      )}
    >
      <div className={cn('flex items-center gap-3 p-3', '@5xl/draft:flex-col @5xl/draft:items-stretch @5xl/draft:gap-0 @5xl/draft:p-0')}>
        <div className={cn('flex min-w-0 flex-1 items-center gap-3', '@5xl/draft:border-b @5xl/draft:border-hairline/5 @5xl/draft:px-4 @5xl/draft:py-3')}>
          <IconTile icon={head.icon} tone={head.tone} spin={draft.status === 'analyzing'} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">{head.title}</p>
            <p className="truncate text-xs text-muted-foreground @5xl/draft:hidden" aria-live="polite" title={status}>{status}</p>
            <p className="hidden text-xs text-muted-foreground @5xl/draft:block">{saving ? 'Saving…' : wideStatus(draft, gate)}</p>
          </div>
        </div>
        <div className={cn('hidden', '@5xl/draft:block @5xl/draft:px-2 @5xl/draft:py-2')}>
          <ReadinessList items={items} onJump={onJump} />
        </div>
        <div className={cn('shrink-0', '@5xl/draft:space-y-2 @5xl/draft:border-t @5xl/draft:border-hairline/5 @5xl/draft:p-3')}>
          <div className={cn('hidden', '@5xl/draft:block')}>
            <Feedback message={feedback?.message ?? null} tone={feedback?.tone} onDismiss={onDismissFeedback} />
          </div>
          <button
            type="button"
            onClick={onPublish}
            disabled={!gate.enabled || busy}
            className={cn(
              'inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-all cursor-pointer',
              'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:border-emerald-500/60 hover:bg-emerald-500/25 hover:text-white',
              'disabled:cursor-not-allowed disabled:border-hairline/10 disabled:bg-hairline/5 disabled:text-muted-foreground disabled:hover:text-muted-foreground',
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Publish
          </button>
        </div>
      </div>
      {feedback && (
        <div className={cn('px-3 pb-3', '@5xl/draft:hidden')}>
          <Feedback message={feedback.message} tone={feedback.tone} onDismiss={onDismissFeedback} />
        </div>
      )}
    </aside>
  )
}

function Workspace({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className={cn('grid items-start gap-4', '@5xl/draft:grid-cols-[minmax(0,1fr)_19rem]')}>
      <div className="min-w-0 space-y-4">{main}</div>
      {side}
    </div>
  )
}

function DraftEditor({ token, draft, onDraftChange, onPublished, screenshotUrl, onScreenshotChanged, children }: DraftWorkspaceProps) {
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

  const details = (
    <Panel title="Map details" icon={PenLine} meta={saving ? 'Saving…' : 'Changes save by themselves.'} className="divide-y divide-hairline/5">
      <MapNameFix key={draft.map_name} draft={draft} renaming={busy === 'rename'} onRename={(name) => { void rename(name) }} />

      <FormSection id={draftFieldId(draft.id, 'author')} title="Credits">
        <div className="grid items-start gap-4 @2xl/draft:grid-cols-2">
          <Field label="Author" required aside={<AuthorModeToggle mode={values.authorMode} setMode={(authorMode) => edit({ authorMode })} />}>
            <AuthorPicker
              mode={values.authorMode}
              setMode={(authorMode) => edit({ authorMode })}
              authorStr={values.authorStr}
              setAuthorStr={(authorStr) => edit({ authorStr }, true)}
              authorUser={values.authorUser}
              setAuthorUser={(authorUser) => edit({ authorUser })}
              token={token}
              showModeToggle={false}
              invalid={!hasAuthor(values)}
            />
          </Field>
          <Field label="Tags" optional>
            <TagEditor tags={values.tags} onChange={(tags) => edit({ tags })} suggestions={tagSuggestions} />
          </Field>
        </div>
      </FormSection>

      <FormSection id={draftFieldId(draft.id, 'gameplay')} title="Gameplay">
        <div className="grid items-start gap-4 @lg/draft:grid-cols-2 @3xl/draft:max-w-xl">
          <Field label="Difficulty" required>
            <AdminSelect value={values.difficulty === null ? '' : String(values.difficulty)} onChange={(v) => edit({ difficulty: v ? Number(v) : null })}
              options={DIFFICULTY_OPTIONS} placeholder="Choose 1 to 10" ariaLabel="Difficulty"
              className={cn('w-full', values.difficulty === null && 'border-red-500/40')} />
          </Field>
          <Field
            label="Required players"
            required
            hint={requiredPlayersMismatch(values, draft) && (
              <p className="flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="size-3" />The name suggests {draft.metadata.required_players_suggested}.
              </p>
            )}
          >
            <AdminSelect value={values.requiredPlayers === null ? '' : String(values.requiredPlayers)} onChange={(v) => edit({ requiredPlayers: Number(v) })}
              options={PLAYER_OPTIONS} placeholder="Not set" ariaLabel="Required players" className="w-full" />
          </Field>
        </div>
        <Field label="Changelog" optional>
          <Input value={values.changelog} onChange={(e) => edit({ changelog: e.target.value }, true)} placeholder="What is new in this map or version" aria-label="Changelog" className="h-9" />
        </Field>
      </FormSection>

      <FormSection id={draftFieldId(draft.id, 'screenshot')} title="Screenshot" optional>
        <DraftScreenshot token={token} draft={draft} url={screenshotUrl} onChanged={onScreenshotChanged} onDraftChange={onDraftChange} onError={showError} />
      </FormSection>

      <FormSection id={draftFieldId(draft.id, 'version')} title="Version">
        <VersionTargetPicker token={token} draft={draft} values={values} onChange={(change) => edit(change)} />
      </FormSection>

      {hasCodePackage(draft) && (
        <CodeReview draft={draft} acknowledged={values.codePackageAcknowledged} onChange={(codePackageAcknowledged) => edit({ codePackageAcknowledged })} />
      )}
    </Panel>
  )

  return (
    <>
      <Workspace
        main={<>{children}{details}</>}
        side={(
          <PublishPanel
            draft={draft}
            values={values}
            gate={gate}
            saving={saving}
            busy={busy === 'publish'}
            feedback={feedback}
            onDismissFeedback={() => setFeedback(null)}
            onPublish={() => { void startPublish() }}
            onJump={(field) => scrollToDraftField(draft.id, field)}
          />
        )}
      />
      <ConfirmDialog
        open={confirming}
        title="Publish without a screenshot"
        message={`${draft.map_name} has no screenshot. Publish it anyway?`}
        confirmLabel="Publish"
        busy={busy === 'publish'}
        onConfirm={() => { void run('publish', publish) }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

function PublishedPanel({ draft, onOpenPublish }: { draft: Draft; onOpenPublish: (publishId: number) => void }) {
  const publishId = draft.publish_id
  return (
    <aside aria-label="Published" className="rounded-xl border border-hairline/5 bg-card/30 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <IconTile icon={Check} tone="emerald" />
        <div>
          <p className="text-sm font-semibold text-foreground">Published</p>
          <p className="text-xs text-muted-foreground">This draft can no longer be edited.</p>
        </div>
      </div>
      {publishId !== null && <ActionButton tone="emerald" icon={Send} onClick={() => onOpenPublish(publishId)}>View the publish</ActionButton>}
    </aside>
  )
}

export function DraftWorkspace(props: DraftWorkspaceProps & { onOpenPublish: (publishId: number) => void }) {
  if (props.draft.status === 'published') {
    return <Workspace main={props.children} side={<PublishedPanel draft={props.draft} onOpenPublish={props.onOpenPublish} />} />
  }
  return <DraftEditor {...props} />
}
