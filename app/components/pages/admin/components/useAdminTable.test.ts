import { describe, expect, it } from 'vitest'
import { cardPanelColumns, cardSortFields } from '@/app/components/shared/DataTable'
import { adminResponsiveColumns, type AdminColumn } from './useAdminTable'

interface Row { name: string; count: number }

const COLUMNS: AdminColumn[] = [
  { id: 'name', label: 'Name', required: true, tier: 'essential' },
  { id: 'count', label: 'Count', tier: 'detail' },
  { id: 'note', label: 'Note', tier: 'detail' },
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
  it('builds every column in the user order and marks the ones the user hid', () => {
    const columns = build(['actions', 'count', 'name', 'note'], ['note'])
    expect(columns.map((c) => c.id)).toEqual(['actions', 'count', 'name', 'note'])
    expect(columns.filter((c) => c.hiddenByUser).map((c) => c.id)).toEqual(['note'])
  })

  it('keeps a hidden column in the card panel and the card sort', () => {
    const columns = build(['name', 'count', 'note'], ['count'])
    expect(cardPanelColumns(columns).map((c) => c.id)).toEqual(['count', 'note'])
    expect(cardSortFields(columns)).toEqual([
      { key: 'name', label: 'Name' },
      { key: 'count', label: 'Count' },
    ])
  })

  it('takes required, tier and label from the admin column and the rest from the spec', () => {
    const [name, count] = build(['name', 'count'])
    expect(name).toMatchObject({ id: 'name', required: true, tier: 'essential', label: 'Name', priority: 90, sortKey: 'name' })
    expect(count).toMatchObject({ id: 'count', required: false, tier: 'detail', label: 'Count', width: '6rem', priority: 30 })
    expect(count.cell?.({ name: 'a', count: 7 })).toBe(7)
  })

  it('feeds the card sort from the spec sort keys with the admin labels', () => {
    expect(cardSortFields(build(['name', 'count', 'note']))).toEqual([
      { key: 'name', label: 'Name' },
      { key: 'count', label: 'Count' },
    ])
  })

  it('skips ids the admin columns do not know', () => {
    expect(adminResponsiveColumns(COLUMNS, ['extra', 'name'], () => true, () => ({ cell: () => null })).map((c) => c.id)).toEqual(['name'])
  })
})
