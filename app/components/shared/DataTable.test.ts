import { describe, expect, expectTypeOf, it } from 'vitest'
import {
    cardPanelColumns, cardSortFields, cardsPerRow, resolveTableLayout,
    type ColumnTier, type ResponsiveColumn, type ResponsiveConfig,
} from './DataTable'

const RECORDS: ResponsiveColumn[] = [
    { id: 'map', required: true, tier: 'essential', label: 'Map' },
    { id: 'holder', required: true, tier: 'essential', label: 'Record Holder' },
    { id: 'time', width: '8rem', required: true, tier: 'essential', label: 'Time' },
    { id: 'difficulty', width: '7rem', priority: 50, tier: 'detail', label: 'Difficulty' },
    { id: 'date', width: '8rem', priority: 30, tier: 'detail', label: 'Date Set' },
    { id: 'actions', width: '8.5rem', priority: 40, tier: 'detail', label: 'Actions' },
]

const HIDDEN_BY_USER: ResponsiveColumn = {
    id: 'country', width: '20rem', priority: 90, tier: 'detail', label: 'Country', sortKey: 'country', hiddenByUser: true,
}

const shown = (ids: Set<string>) => [...ids].sort()

describe('every column declares a tier and a panel label', () => {
    it('makes the tier and the label required', () => {
        expectTypeOf<Pick<ResponsiveColumn, 'tier' | 'label'>>().toEqualTypeOf<{ tier: ColumnTier; label: string }>()
    })

    it('gives a responsive table either cards or an explicit table-only rule', () => {
        expectTypeOf<{ columns: ResponsiveColumn[] }>().not.toMatchTypeOf<ResponsiveConfig>()
        expectTypeOf<{ columns: ResponsiveColumn[]; tableOnly: true }>().toMatchTypeOf<ResponsiveConfig>()
    })
})

describe('desktop keeps priority dropping', () => {
    const desktop = { touch: false, cards: true }

    it('shows every column when they all fit', () => {
        const layout = resolveTableLayout(RECORDS, 60, desktop)
        expect(layout.table).toBe(true)
        expect(shown(layout.visibleIds)).toEqual(['actions', 'date', 'difficulty', 'holder', 'map', 'time'])
        expect(layout.minWidth).toBe('55.5rem')
    })

    it('drops the lowest priority column first', () => {
        const layout = resolveTableLayout(RECORDS, 50, desktop)
        expect(layout.table).toBe(true)
        expect(shown(layout.visibleIds)).toEqual(['actions', 'difficulty', 'holder', 'map', 'time'])
        expect(shown(layout.hiddenIds)).toEqual(['date'])
    })

    it('skips a column that does not fit and keeps a narrower one with lower priority', () => {
        const layout = resolveTableLayout(RECORDS, 47, desktop)
        expect(shown(layout.visibleIds)).toEqual(['date', 'difficulty', 'holder', 'map', 'time'])
        expect(shown(layout.hiddenIds)).toEqual(['actions'])
    })

    it('keeps a cut-down table while the required columns fit', () => {
        const layout = resolveTableLayout(RECORDS, 32, desktop)
        expect(layout.table).toBe(true)
        expect(shown(layout.visibleIds)).toEqual(['holder', 'map', 'time'])
    })

    it('gives up the table only when the required columns do not fit', () => {
        expect(resolveTableLayout(RECORDS, 31, desktop).table).toBe(false)
    })

    it('treats an unmeasured container as fitting', () => {
        expect(resolveTableLayout(RECORDS, 0, desktop).table).toBe(true)
    })

    it('leaves a column the user hid out of the table', () => {
        const layout = resolveTableLayout([...RECORDS, HIDDEN_BY_USER], 80, desktop)
        expect(shown(layout.visibleIds)).toEqual(['actions', 'date', 'difficulty', 'holder', 'map', 'time'])
        expect(layout.minWidth).toBe('55.5rem')
    })
})

describe('touch shows the whole table or cards', () => {
    const touch = { touch: true, cards: true }
    const THUMBNAIL: ResponsiveColumn = { id: 'thumbnail', width: '4rem', priority: 10, tier: 'decorative', label: 'Thumbnail' }
    const WITH_THUMBNAIL = [THUMBNAIL, ...RECORDS]

    it('renders cards instead of a cut-down table', () => {
        expect(resolveTableLayout(RECORDS, 50, touch).table).toBe(false)
        expect(resolveTableLayout(RECORDS, 55, touch).table).toBe(false)
    })

    it('renders the table once every column fits', () => {
        const layout = resolveTableLayout(RECORDS, 55.5, touch)
        expect(layout.table).toBe(true)
        expect(shown(layout.visibleIds)).toEqual(['actions', 'date', 'difficulty', 'holder', 'map', 'time'])
    })

    it('may drop a decorative column to keep the table', () => {
        const layout = resolveTableLayout(WITH_THUMBNAIL, 56, touch)
        expect(layout.table).toBe(true)
        expect(shown(layout.hiddenIds)).toEqual(['thumbnail'])
        expect(shown(resolveTableLayout(WITH_THUMBNAIL, 60, touch).visibleIds)).toContain('thumbnail')
    })

    it('does not switch to cards because of a column the user hid', () => {
        const layout = resolveTableLayout([...RECORDS, HIDDEN_BY_USER], 55.5, touch)
        expect(layout.table).toBe(true)
        expect(layout.visibleIds.has('country')).toBe(false)
    })

    it('treats an unmeasured container as fitting', () => {
        expect(resolveTableLayout(RECORDS, 0, touch).table).toBe(true)
    })
})

describe('table-only tables', () => {
    const tableOnly = { touch: true, cards: false }

    it('drop columns by priority on touch too', () => {
        const layout = resolveTableLayout(RECORDS, 50, tableOnly)
        expect(layout.table).toBe(true)
        expect(shown(layout.hiddenIds)).toEqual(['date'])
    })
})

describe('cards per row', () => {
    it('stacks cards in a phone-wide container', () => {
        expect(cardsPerRow(358)).toBe(1)
        expect(cardsPerRow(599)).toBe(1)
    })

    it('lays out two cards per row from 600 px of container', () => {
        expect(cardsPerRow(600)).toBe(2)
        expect(cardsPerRow(712)).toBe(2)
    })

    it('stacks cards before the container is measured', () => {
        expect(cardsPerRow(0)).toBe(1)
    })
})

describe('column tiers', () => {
    const RUSHERS: ResponsiveColumn[] = [
        { id: 'rank', width: '5rem', required: true, tier: 'essential', label: 'Rank' },
        { id: 'rusher', required: true, tier: 'essential', label: 'Rusher' },
        { id: 'bar', width: '4rem', tier: 'decorative', label: 'Bar' },
        { id: 'median', width: '8rem', priority: 35, tier: 'detail', label: 'Median WR' },
        { id: 'average', width: '8rem', priority: 34, tier: 'detail', label: 'Average WR' },
    ]

    it('puts detail columns in the expand panel, in display order', () => {
        expect(cardPanelColumns(RUSHERS).map(column => column.label)).toEqual(['Median WR', 'Average WR'])
    })

    it('keeps essential and decorative columns out of the panel', () => {
        expect(cardPanelColumns(RECORDS).map(column => column.id)).toEqual(['difficulty', 'date', 'actions'])
    })

    it('lists a column the user hid in the panel', () => {
        expect(cardPanelColumns([...RECORDS, HIDDEN_BY_USER]).map(column => column.id)).toEqual(['difficulty', 'date', 'actions', 'country'])
    })

    it('builds the card sort fields from the sortable columns', () => {
        const columns = RECORDS.map(column => column.id === 'actions' ? column : { ...column, sortKey: column.id })
        expect(cardSortFields(columns)).toEqual([
            { key: 'map', label: 'Map' },
            { key: 'holder', label: 'Record Holder' },
            { key: 'time', label: 'Time' },
            { key: 'difficulty', label: 'Difficulty' },
            { key: 'date', label: 'Date Set' },
        ])
    })

    it('offers a column the user hid as a card sort field', () => {
        expect(cardSortFields([...RECORDS, HIDDEN_BY_USER])).toEqual([{ key: 'country', label: 'Country' }])
    })

    it('offers no card sort for a table without sortable columns', () => {
        expect(cardSortFields(RUSHERS)).toEqual([])
    })
})
