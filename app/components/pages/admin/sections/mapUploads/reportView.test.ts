import { describe, expect, it } from 'vitest'
import type { Draft, DraftFile } from '@/app/utils/mapUploadTypes'
import { mapUploadFixture } from '@/app/utils/fixtures/mapUploadFixtures'
import { formValuesFromDraft } from './draftFormState'
import { blockField, dispositionCounts, draftFieldId, groupObjects, readinessItems, shippedBytes, sortFiles, warningField } from './reportView'

function file(name: string, kind: DraftFile['kind'], disposition: DraftFile['disposition'], size = 10): DraftFile {
  return { file: name, kind, disposition, size, sha256: 'a'.repeat(64), reason_code: null, reason: null }
}

describe('groupObjects', () => {
  it('groups object paths by the part between the package and the name', () => {
    expect(groupObjects([
      'HourIndusX_UT.Woods.HourIndus_wood5',
      'HourIndusX_UT.Bases.HourIndus_basewood',
      'HourIndusX_UT.Bases.HourIndus_baseconcrete',
    ])).toEqual([
      { group: 'Bases', names: ['HourIndus_baseconcrete', 'HourIndus_basewood'] },
      { group: 'Woods', names: ['HourIndus_wood5'] },
    ])
  })

  it('puts objects without a group first, and joins deeper paths into one group', () => {
    expect(groupObjects(['Pkg.Outer.Inner.Thing', 'Pkg.Spawner'])).toEqual([
      { group: null, names: ['Spawner'] },
      { group: 'Outer.Inner', names: ['Thing'] },
    ])
  })

  it('keeps a bare name as it is', () => {
    expect(groupObjects(['Lonely'])).toEqual([{ group: null, names: ['Lonely'] }])
  })
})

describe('files', () => {
  const files = [
    file('zeta.utx', 'texture', 'dropped'),
    file('Alpha.uax', 'sound', 'skip-identical'),
    file('beta.utx', 'texture', 'install', 300),
    file('CTF-BT-Map.unr', 'map', 'install', 1000),
    file('Gamma.umx', 'music', 'keep-existing'),
  ]

  it('sorts the map first, then by what happens to each file, then by name', () => {
    expect(sortFiles(files).map((f) => f.file)).toEqual(['CTF-BT-Map.unr', 'beta.utx', 'Alpha.uax', 'Gamma.umx', 'zeta.utx'])
  })

  it('counts each outcome in display order and leaves out empty ones', () => {
    expect(dispositionCounts(files)).toEqual([
      { disposition: 'install', count: 2 },
      { disposition: 'skip-identical', count: 1 },
      { disposition: 'keep-existing', count: 1 },
      { disposition: 'dropped', count: 1 },
    ])
    expect(dispositionCounts([file('a.utx', 'texture', 'install')])).toEqual([{ disposition: 'install', count: 1 }])
  })

  it('adds up only the bytes that will be installed', () => {
    expect(shippedBytes(files)).toBe(1300)
  })
})

describe('fields', () => {
  it('points each fixable finding at the field that fixes it', () => {
    expect(blockField('name_taken')).toBe('name')
    expect(blockField('code_package_unacknowledged')).toBe('code')
    expect(blockField('version_target_has_successor')).toBe('version')
    expect(blockField('missing_package')).toBeNull()
    expect(warningField('no_screenshot')).toBe('screenshot')
    expect(blockField('name_empty')).toBe('name')
    expect(blockField('author_missing')).toBe('author')
    expect(blockField('difficulty_missing')).toBe('gameplay')
    expect(warningField('required_players_mismatch')).toBe('gameplay')
    expect(warningField('name_normalised')).toBeNull()
  })

  it('gives every field an id unique to its draft', () => {
    expect(draftFieldId(7, 'name')).toBe('map-upload-draft-7-name')
    expect(draftFieldId(8, 'name')).not.toBe(draftFieldId(7, 'name'))
  })
})

describe('readinessItems', () => {
  const ready = mapUploadFixture('draft') as Draft

  function states(draft: Draft, change: Partial<ReturnType<typeof formValuesFromDraft>> = {}) {
    return Object.fromEntries(readinessItems(draft, { ...formValuesFromDraft(draft), ...change }).map((item) => [item.id, item.state]))
  }

  it('puts the required details first and marks them done when set', () => {
    const items = readinessItems(ready, formValuesFromDraft(ready))
    expect(items.slice(0, 3).map((item) => item.id)).toEqual(['author', 'difficulty', 'players'])
    expect(states(ready)).toMatchObject({ author: 'ok', difficulty: 'ok', players: 'ok', blocks: 'ok' })
  })

  it('marks a missing author or difficulty as to do, not optional', () => {
    expect(states(ready, { authorMode: 'text', authorStr: '  ' })).toMatchObject({ author: 'todo' })
    expect(states(ready, { authorMode: 'player', authorUser: null })).toMatchObject({ author: 'todo' })
    expect(states(ready, { difficulty: null })).toMatchObject({ difficulty: 'todo' })
  })

  it('does not count the author and difficulty blocks twice', () => {
    const blocked: Draft = {
      ...ready,
      status: 'invalid',
      blocks: [
        { code: 'author_missing', message: 'Set the author.', package: null, hosts: [], objects: [] },
        { code: 'difficulty_missing', message: 'Set the difficulty.', package: null, hosts: [], objects: [] },
      ],
    }
    expect(states(blocked, { authorStr: '', authorMode: 'text', difficulty: null })).toMatchObject({ author: 'todo', difficulty: 'todo', blocks: 'ok' })
  })

  it('keeps the screenshot optional', () => {
    expect(states({ ...ready, screenshot: { source: 'none', embedded_available: false } })).toMatchObject({ screenshot: 'optional' })
  })
})
