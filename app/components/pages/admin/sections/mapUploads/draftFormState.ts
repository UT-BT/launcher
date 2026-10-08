import type { MapUploadDraftPatch, PublishDraftResult } from '@/app/utils/api'
import type { BlockCode, Draft, DraftBlock, VersionMode } from '@/app/utils/mapUploadTypes'
import type { AuthorUser } from '../../components/AuthorPicker'

export const TEXT_DEBOUNCE_MS = 600

export const DRAFT_CHANGED_MESSAGE = 'The draft changed since it was checked. See the updated report.'

export interface DraftFormValues {
  authorMode: 'text' | 'player'
  authorStr: string
  authorUser: AuthorUser | null
  difficulty: number | null
  tags: string[]
  changelog: string
  requiredPlayers: number | null
  versionTarget: string | null
  versionMode: VersionMode | null
  codePackageAcknowledged: boolean
}

export function formValuesFromDraft(draft: Draft): DraftFormValues {
  const { metadata } = draft
  const linked = metadata.author_ref
  return {
    authorMode: !linked && metadata.author_str ? 'text' : 'player',
    authorStr: linked ? '' : metadata.author_str ?? '',
    authorUser: linked ? { id: linked, alias: metadata.author || null } : null,
    difficulty: metadata.difficulty,
    tags: metadata.tags,
    changelog: metadata.changelog,
    requiredPlayers: metadata.required_players,
    versionTarget: draft.version.target,
    versionMode: draft.version.mode,
    codePackageAcknowledged: draft.acknowledgements.code_package,
  }
}

export function hasAuthor(values: DraftFormValues): boolean {
  return values.authorMode === 'player' ? values.authorUser !== null : values.authorStr.trim() !== ''
}

function sameAuthor(a: DraftFormValues, b: DraftFormValues): boolean {
  return a.authorStr === b.authorStr && a.authorUser?.id === b.authorUser?.id
}

function patchFields(values: DraftFormValues): Record<string, unknown> {
  return {
    author: values.authorMode === 'text'
      ? { author_str: values.authorStr.trim() || null, author_ref: null }
      : values.authorUser ? { author_ref: values.authorUser.id, author_str: null } : undefined,
    difficulty: values.difficulty,
    tags: values.tags,
    changelog: values.changelog,
    required_players: values.requiredPlayers,
    version_target: values.versionTarget,
    version_mode: values.versionMode,
    acknowledgements: { code_package: values.codePackageAcknowledged },
  }
}

export function draftPatch(base: DraftFormValues, next: DraftFormValues): MapUploadDraftPatch {
  const before = patchFields(base)
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patchFields(next))) {
    if (value === undefined || JSON.stringify(value) === JSON.stringify(before[key])) continue
    if (key === 'author') Object.assign(patch, value)
    else patch[key] = value
  }
  return patch
}

const NAME_BLOCK_CODES: BlockCode[] = ['bad_prefix', 'name_empty', 'bad_characters', 'name_too_long', 'name_taken']
const PREFIXED_TITLE = /^ctf-bt[-+](?:[ivx]+-)?(.*)$/i

export function hasMapTitle(name: string): boolean {
  const match = PREFIXED_TITLE.exec(name.trim())
  return !match || /[a-z]/i.test(match[1])
}

export function nameBlocks(draft: Draft): DraftBlock[] {
  return draft.blocks.filter((block) => NAME_BLOCK_CODES.includes(block.code))
}

export function suggestMapName(name: string): string {
  const trimmed = name.trim()
  const prefixed = /^ctf-bt([-+])(.*)$/i.exec(trimmed)
  if (prefixed) return `CTF-BT${prefixed[1]}${prefixed[2]}`
  const rest = /^(?:ctf[-_ ]?bt[-_ ]?|bt[-_ ]|ctf[-_ ])(.+)$/i.exec(trimmed)
  return `CTF-BT-${rest ? rest[1] : trimmed}`
}

export function requiredPlayersMismatch(values: DraftFormValues, draft: Draft): boolean {
  return values.requiredPlayers !== null && values.requiredPlayers !== draft.metadata.required_players_suggested
}

export function hasCodePackage(draft: Draft): boolean {
  return draft.warnings.some((w) => w.code === 'code_package') || draft.blocks.some((b) => b.code === 'code_package_unacknowledged')
}

export interface PublishGate {
  enabled: boolean
  reason: string | null
}

function closed(reason: string): PublishGate {
  return { enabled: false, reason }
}

export function publishGate(draft: Draft): PublishGate {
  if (draft.status === 'analyzing') return closed('Wait for the checks.')
  if (hasCodePackage(draft) && !draft.acknowledgements.code_package) return closed('Review the code package first.')
  if (draft.version.target !== null && draft.version.mode === null) return closed('Choose what happens to the old map.')
  if (draft.status !== 'ready' || draft.blocks.length > 0) return closed('Fix the blocks first.')
  return { enabled: true, reason: null }
}

export type PublishStep = 'blocked' | 'confirm-no-screenshot' | 'publish'

export function publishNextStep(draft: Draft): PublishStep {
  if (!publishGate(draft).enabled) return 'blocked'
  return draft.screenshot.source === 'none' ? 'confirm-no-screenshot' : 'publish'
}

export type PublishOutcome =
  | { kind: 'open'; publishId: number }
  | { kind: 'stale'; draft: Draft; message: string }

export function publishOutcome(result: PublishDraftResult): PublishOutcome {
  if (result.kind === 'started') return { kind: 'open', publishId: result.publishId }
  return { kind: 'stale', draft: result.draft, message: DRAFT_CHANGED_MESSAGE }
}

export interface DraftAutosaveState {
  values: DraftFormValues
  saving: boolean
}

export interface DraftAutosave {
  state: () => DraftAutosaveState
  edit: (change: Partial<DraftFormValues>, opts?: { debounce?: boolean }) => void
  sync: (draft: Draft) => void
  flush: () => Promise<Draft | null>
  dispose: () => void
}

export function createDraftAutosave({ initial, save, onSaved, onError, onState, delayMs = TEXT_DEBOUNCE_MS }: {
  initial: DraftFormValues
  save: (patch: MapUploadDraftPatch) => Promise<Draft>
  onSaved: (draft: Draft) => void
  onError: (error: unknown) => void
  onState?: (state: DraftAutosaveState) => void
  delayMs?: number
}): DraftAutosave {
  let base = initial
  let values = initial
  let timer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<unknown> = Promise.resolve()
  let pending = 0
  let lastSaved: Draft | null = null
  let failure: unknown = null
  let disposed = false

  const state = (): DraftAutosaveState => ({ values, saving: timer !== null || pending > 0 })
  const emit = () => { if (!disposed) onState?.(state()) }
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const step = async () => {
    failure = null
    const patch = draftPatch(base, values)
    if (Object.keys(patch).length === 0) return
    const sent = values
    try {
      lastSaved = await save(patch)
      base = sent
      if (!disposed) onSaved(lastSaved)
    } catch (error) {
      failure = error
      if (!disposed) onError(error)
    }
  }

  const send = () => {
    clearTimer()
    pending += 1
    queue = queue.then(step).finally(() => {
      pending -= 1
      emit()
    })
    emit()
    return queue
  }

  return {
    state,
    edit(change, opts = {}) {
      values = { ...values, ...change }
      if (!opts.debounce) {
        void send()
        return
      }
      clearTimer()
      timer = setTimeout(() => { void send() }, delayMs)
      emit()
    },
    sync(draft) {
      if (timer !== null || pending > 0) return
      const read = formValuesFromDraft(draft)
      const keepMode = !hasAuthor(values) && sameAuthor(base, read)
      base = keepMode ? { ...read, authorMode: values.authorMode } : read
      values = base
      emit()
    },
    async flush() {
      const before = lastSaved
      await send()
      if (failure) throw failure
      return lastSaved === before ? null : lastSaved
    },
    dispose() {
      const waiting = timer !== null
      clearTimer()
      disposed = true
      if (waiting) void send()
    },
  }
}
