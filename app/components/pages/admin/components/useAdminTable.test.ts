import { describe, expect, it } from 'vitest'
import { cardPanelColumns, cardSortFields } from '@/app/components/shared/DataTable'
import { adminResponsiveColumns, type AdminColumn } from './useAdminTable'

interface Row { name: string; count: number }

const COLUMNS: AdminColumn[] = [
  { id: 'name', label: 'Name', required: true, tier: 'essential' },
  { id: 'count', label: 'Count', tier: 'detail' },
  { id: 'note', label: 'Note' },
  { id: 'actions', label: 'Actions', required: true, tier: 'essential' },
]

const SPEC = {
  name: { priority: 90, sortKey: 'name', cell: (row: Row) => row.name },
  count: { width: '6rem', priority: 30, sortKey: 'count', cell: (row: Row) => row.count },
  note: { width: '9rem', cell: () => 'note' },
  actions: { width: '8rem', cell: () => 'act' },
}

const build = (order: string[], hidden: string[] = []) =>
  adminResponsiveColumns(COLUMNS, order, (id) => !hidden.includes(id), (id) => SPEC[id as keyof typeof SPEC])

describe('adminResponsiveColumns', () => {
  it('builds the columns in the user order and drops hidden ones', () => {
    expect(build(['actions', 'count', 'name', 'note'], ['note']).map((c) => c.id)).toEqual(['actions', 'count', 'name'])
  })

  it('takes required, tier and label from the admin column and the rest from the spec', () => {
    const [name, count] = build(['name', 'count'])
    expect(name).toMatchObject({ id: 'name', required: true, tier: 'essential', label: 'Name', priority: 90, sortKey: 'name' })
    expect(count).toMatchObject({ id: 'count', required: false, tier: 'detail', label: 'Count', width: '6rem', priority: 30 })
    expect(count.cell?.({ name: 'a', count: 7 })).toBe(7)
  })

  it('leaves the tier unset where the admin column declares none, so DataTable treats it as detail', () => {
    const [note] = build(['note'])
    expect(note.tier).toBeUndefined()
    expect(cardPanelColumns(build(['name', 'count', 'note', 'actions'])).map((c) => c.id)).toEqual(['count', 'note'])
  })

  it('feeds the card sort from the spec sort keys with the admin labels', () => {
    expect(cardSortFields(build(['name', 'count', 'note']))).toEqual([
      { key: 'name', label: 'Name' },
      { key: 'count', label: 'Count' },
    ])
  })

  it('lists ids the admin columns do not know as unrequired detail columns labelled by id', () => {
    const [extra] = adminResponsiveColumns(COLUMNS, ['extra'], () => true, () => ({ cell: () => null }))
    expect(extra).toMatchObject({ id: 'extra', required: false, label: 'extra' })
  })
})
