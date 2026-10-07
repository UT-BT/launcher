import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapUploadDraftPatch } from '@/app/utils/api'
import type { Draft } from '@/app/utils/mapUploadTypes'
import { mapUploadErrorFixture, mapUploadFixture } from '@/app/utils/fixtures/mapUploadFixtures'
import {
  DRAFT_CHANGED_MESSAGE, TEXT_DEBOUNCE_MS, createDraftAutosave, draftPatch, formValuesFromDraft, hasCodePackage,
  nameBlocks, publishGate, publishNextStep, publishOutcome, requiredPlayersMismatch, suggestMapName,
  type DraftAutosaveState, type DraftFormValues,
} from './draftFormState'

function draftWith(overrides: Partial<Draft> = {}, from: Draft = mapUploadFixture('draftScreenshotPut')): Draft {
  return { ...from, ...overrides }
}

const ready = draftWith()
const readyValues = formValuesFromDraft(ready)

describe('formValuesFromDraft', () => {
  it('reads a free-text author and the metadata', () => {
    expect(readyValues).toEqual({
      authorMode: 'text', authorStr: 'Bob', authorUser: null,
      difficulty: 5, tags: ['Speed', 'Tech'], changelog: '', requiredPlayers: 1,
      versionTarget: null, versionMode: null, codePackageAcknowledged: true,
    })
  })

  it('reads a linked author with the resolved name, and the version choice', () => {
    const values = formValuesFromDraft(mapUploadFixture('draftPatch'))
    expect(values.authorMode).toBe('player')
    expect(values.authorUser).toEqual({ id: '318273645509182736', alias: 'Bob' })
    expect(values.authorStr).toBe('')
    expect(values.versionTarget).toBe('CTF-BT-Foo-v1')
    expect(values.versionMode).toBe('update')
  })
})

describe('draftPatch', () => {
  const edit = (change: Partial<DraftFormValues>) => draftPatch(readyValues, { ...readyValues, ...change })

  it('is empty when nothing changed', () => {
    expect(draftPatch(readyValues, { ...readyValues, tags: [...readyValues.tags] })).toEqual({})
  })

  it('sends only the changed fields', () => {
    expect(edit({ difficulty: 7 })).toEqual({ difficulty: 7 })
    expect(edit({ changelog: 'New jump', requiredPlayers: 2 })).toEqual({ changelog: 'New jump', required_players: 2 })
    expect(edit({ tags: ['Speed'] })).toEqual({ tags: ['Speed'] })
    expect(edit({ codePackageAcknowledged: false })).toEqual({ acknowledgements: { code_package: false } })
  })

  it('sends a free-text author trimmed, and clears the linked one', () => {
    expect(edit({ authorStr: '  Carol ' })).toEqual({ author_str: 'Carol', author_ref: null })
    expect(edit({ authorStr: 'Bob  ' })).toEqual({})
    expect(edit({ authorStr: ' ' })).toEqual({ author_str: null, author_ref: null })
  })

  it('sends a linked author only once a player is picked', () => {
    expect(edit({ authorMode: 'player', authorUser: null })).toEqual({})
    expect(edit({ authorMode: 'player', authorUser: { id: '42', alias: 'Dave' } })).toEqual({ author_ref: '42', author_str: null })
  })

  it('sends the version target and mode, and clears both together', () => {
    expect(edit({ versionTarget: 'CTF-BT-Foo-v1' })).toEqual({ version_target: 'CTF-BT-Foo-v1' })
    expect(edit({ versionTarget: 'CTF-BT-Foo-v1', versionMode: 'rework-retire' })).toEqual({ version_target: 'CTF-BT-Foo-v1', version_mode: 'rework-retire' })
    const versioned = formValuesFromDraft(mapUploadFixture('draftPatch'))
    expect(draftPatch(versioned, { ...versioned, versionTarget: null, versionMode: null })).toEqual({ version_target: null, version_mode: null })
  })
})

describe('suggestMapName', () => {
  it.each([
    ['ctf-bt-Foo', 'CTF-BT-Foo'],
    ['ctf-bt+Foo', 'CTF-BT+Foo'],
    ['Foo', 'CTF-BT-Foo'],
    ['CTF-BTFoo', 'CTF-BT-Foo'],
    ['CTFBT-Foo', 'CTF-BT-Foo'],
    ['ctf_bt_Foo', 'CTF-BT-Foo'],
    ['CTF-Foo', 'CTF-BT-Foo'],
    ['BT-Foo', 'CTF-BT-Foo'],
    ['CTF-BT-Foo', 'CTF-BT-Foo'],
  ])('suggests a corrected name for %s', (name, expected) => {
    expect(suggestMapName(name)).toBe(expected)
  })
})

describe('nameBlocks', () => {
  it('keeps only the blocks about the map name', () => {
    const blocks = nameBlocks(mapUploadFixture('draftScreenshotEmbedded'))
    expect(blocks.map((b) => b.code)).toEqual(['name_taken'])
  })

  it('is empty for a draft whose name is fine', () => {
    expect(nameBlocks(ready)).toEqual([])
  })
})

describe('requiredPlayersMismatch', () => {
  it('flags a value that differs from the suggestion', () => {
    expect(requiredPlayersMismatch({ ...readyValues, requiredPlayers: 1 }, ready)).toBe(true)
    expect(requiredPlayersMismatch({ ...readyValues, requiredPlayers: 2 }, ready)).toBe(false)
    expect(requiredPlayersMismatch({ ...readyValues, requiredPlayers: null }, ready)).toBe(false)
  })
})

describe('hasCodePackage', () => {
  it('is true when the report warns about a code package or blocks on its review', () => {
    expect(hasCodePackage(ready)).toBe(true)
    expect(hasCodePackage(mapUploadFixture('draftScreenshotEmbedded'))).toBe(true)
    expect(hasCodePackage(draftWith({ warnings: [], blocks: [] }))).toBe(false)
  })
})

describe('publishGate', () => {
  it('is open for a ready draft with no blocks', () => {
    expect(publishGate(ready)).toEqual({ enabled: true, reason: null })
  })

  it('is closed while a draft has blocks', () => {
    const gate = publishGate(mapUploadFixture('draftScreenshotEmbedded'))
    expect(gate.enabled).toBe(false)
    expect(gate.reason).toMatch(/review the code package/i)
    expect(publishGate(draftWith({ blocks: mapUploadFixture('draftScreenshotEmbedded').blocks.slice(0, 1) })).enabled).toBe(false)
  })

  it('is closed for an unacknowledged code package even without a block', () => {
    const gate = publishGate(draftWith({ acknowledgements: { code_package: false } }))
    expect(gate).toEqual({ enabled: false, reason: expect.stringMatching(/code package/i) })
  })

  it.each(['analyzing', 'invalid', 'published'] as const)('is closed for a %s draft', (status) => {
    expect(publishGate(draftWith({ status })).enabled).toBe(false)
  })

  it('is closed when a version target has no mode', () => {
    const gate = publishGate(draftWith({ version: { target: 'CTF-BT-Foo-v1', mode: null, candidates: [] } }))
    expect(gate).toEqual({ enabled: false, reason: expect.stringMatching(/old map/i) })
  })
})

describe('publishNextStep', () => {
  it('publishes a ready draft with a screenshot', () => {
    expect(publishNextStep(ready)).toBe('publish')
  })

  it('asks first when there is no screenshot', () => {
    expect(publishNextStep(mapUploadFixture('draftScreenshotDelete'))).toBe('confirm-no-screenshot')
  })

  it('stops when the gate is closed', () => {
    expect(publishNextStep(draftWith({ status: 'invalid' }))).toBe('blocked')
  })
})

describe('publishOutcome', () => {
  it('opens the new publish on 202', () => {
    expect(publishOutcome({ kind: 'started', publishId: 3 })).toEqual({ kind: 'open', publishId: 3 })
  })

  it('keeps the re-checked report on 409', () => {
    const fresh = mapUploadErrorFixture('errorDraftInvalid').data as Draft
    const outcome = publishOutcome({ kind: 'invalid', draft: fresh })
    expect(outcome).toEqual({ kind: 'stale', draft: fresh, message: DRAFT_CHANGED_MESSAGE })
    expect(outcome.kind === 'stale' && outcome.draft.blocks.map((b) => b.code)).toEqual(['name_taken'])
  })
})

describe('createDraftAutosave', () => {
  let saves: MapUploadDraftPatch[]
  let resolvers: ((draft: Draft) => void)[]
  let rejecters: ((error: unknown) => void)[]
  let saved: Draft[]
  let errors: unknown[]
  let states: DraftAutosaveState[]

  function setup(initial: Draft = ready) {
    return createDraftAutosave({
      initial: formValuesFromDraft(initial),
      save: (patch) => {
        saves.push(patch)
        return new Promise<Draft>((resolve, reject) => { resolvers.push(resolve); rejecters.push(reject) })
      },
      onSaved: (draft) => saved.push(draft),
      onError: (error) => errors.push(error),
      onState: (state) => states.push(state),
    })
  }

  async function settle() {
    await vi.advanceTimersByTimeAsync(0)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    saves = []; resolvers = []; rejecters = []; saved = []; errors = []; states = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves a non-text change at once, with only that field', async () => {
    const autosave = setup()
    autosave.edit({ difficulty: 8 })
    expect(autosave.state()).toMatchObject({ saving: true, values: { difficulty: 8 } })
    await settle()
    expect(saves).toEqual([{ difficulty: 8 }])
    resolvers[0](draftWith({ metadata: { ...ready.metadata, difficulty: 8 } }))
    await settle()
    expect(saved).toHaveLength(1)
    expect(autosave.state().saving).toBe(false)
  })

  it('debounces text edits into one save', async () => {
    const autosave = setup()
    autosave.edit({ changelog: 'F' }, { debounce: true })
    autosave.edit({ changelog: 'Fi' }, { debounce: true })
    autosave.edit({ changelog: 'Fix' }, { debounce: true })
    expect(saves).toEqual([])
    expect(autosave.state().saving).toBe(true)
    await vi.advanceTimersByTimeAsync(TEXT_DEBOUNCE_MS - 1)
    expect(saves).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(saves).toEqual([{ changelog: 'Fix' }])
    expect(autosave.state().saving).toBe(true)
  })

  it('does not save when a text edit ends where it started', async () => {
    const autosave = setup()
    autosave.edit({ changelog: 'x' }, { debounce: true })
    autosave.edit({ changelog: '' }, { debounce: true })
    await vi.advanceTimersByTimeAsync(TEXT_DEBOUNCE_MS)
    expect(saves).toEqual([])
    expect(autosave.state().saving).toBe(false)
  })

  it('sends edits made during a save afterwards, diffed against what was sent', async () => {
    const autosave = setup()
    autosave.edit({ difficulty: 8 })
    await settle()
    autosave.edit({ requiredPlayers: 2 })
    await settle()
    expect(saves).toHaveLength(1)
    resolvers[0](ready)
    await settle()
    expect(saves).toEqual([{ difficulty: 8 }, { required_players: 2 }])
  })

  it('re-reads the values from a draft only when nothing is waiting to be saved', async () => {
    const autosave = setup()
    const prefilled = mapUploadFixture('draftPatch')
    autosave.edit({ changelog: 'typing' }, { debounce: true })
    autosave.sync(prefilled)
    expect(autosave.state().values.changelog).toBe('typing')
    await vi.advanceTimersByTimeAsync(TEXT_DEBOUNCE_MS)
    resolvers[0](ready)
    await settle()
    autosave.sync(prefilled)
    expect(autosave.state().values).toEqual(formValuesFromDraft(prefilled))
    autosave.edit({ difficulty: 6 })
    expect(saves).toHaveLength(1)
  })

  it('keeps player mode chosen with nobody picked yet when a draft is re-read', async () => {
    const autosave = setup()
    autosave.edit({ authorMode: 'player' })
    await settle()
    expect(saves).toEqual([])
    autosave.sync(draftWith({ updated_at: '2026-10-06T20:09:00+00:00' }))
    expect(autosave.state().values).toMatchObject({ authorMode: 'player', authorUser: null })
    autosave.edit({ difficulty: 6 })
    await settle()
    expect(saves).toEqual([{ difficulty: 6 }])
  })

  it('flush sends a waiting text edit at once and answers the saved draft', async () => {
    const autosave = setup()
    autosave.edit({ authorStr: 'Carol' }, { debounce: true })
    const flushed = autosave.flush()
    expect(autosave.state().saving).toBe(true)
    await settle()
    expect(saves).toEqual([{ author_str: 'Carol', author_ref: null }])
    const answer = draftWith({ updated_at: '2026-10-06T20:09:00+00:00' })
    resolvers[0](answer)
    await expect(flushed).resolves.toBe(answer)
  })

  it('flush answers null when nothing was waiting', async () => {
    await expect(setup().flush()).resolves.toBeNull()
  })

  it('flush rejects when the save it waits for fails, so publish does not go ahead', async () => {
    const autosave = setup()
    autosave.edit({ changelog: 'unsaved' }, { debounce: true })
    const flushed = autosave.flush()
    await settle()
    rejecters[0](new Error('offline'))
    await expect(flushed).rejects.toThrow('offline')
    expect(errors).toEqual([new Error('offline')])
  })

  it('flush sends a failed change again and answers the draft once it saves', async () => {
    const autosave = setup()
    autosave.edit({ difficulty: 8 })
    await settle()
    rejecters[0](new Error('offline'))
    await settle()
    const flushed = autosave.flush()
    await settle()
    expect(saves).toEqual([{ difficulty: 8 }, { difficulty: 8 }])
    resolvers[1](ready)
    await expect(flushed).resolves.toBe(ready)
  })

  it('reports a failed save and sends the change again with the next edit', async () => {
    const autosave = setup()
    autosave.edit({ difficulty: 8 })
    await settle()
    rejecters[0](new Error('offline'))
    await settle()
    expect(errors).toEqual([new Error('offline')])
    expect(autosave.state().saving).toBe(false)
    autosave.edit({ tags: ['Tech'] })
    await settle()
    expect(saves.at(-1)).toEqual({ difficulty: 8, tags: ['Tech'] })
  })

  it('sends a waiting edit when disposed, without calling back', async () => {
    const autosave = setup()
    autosave.edit({ changelog: 'last words' }, { debounce: true })
    const before = states.length
    autosave.dispose()
    await settle()
    expect(saves).toEqual([{ changelog: 'last words' }])
    resolvers[0](ready)
    await settle()
    expect(saved).toEqual([])
    expect(states).toHaveLength(before)
  })
})
