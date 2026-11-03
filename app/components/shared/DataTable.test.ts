import { describe, expect, it } from 'vitest'
import { cardPanelColumns, cardSortFields, cardsPerRow, resolveTableLayout, type ResponsiveColumn } from './DataTable'

const RECORDS: ResponsiveColumn[] = [
    { id: 'map', required: true, tier: 'essential', label: 'Map' },
    { id: 'holder', required: true, tier: 'essential', label: 'Record Holder' },
    { id: 'time', width: '8rem', required: true, tier: 'essential', label: 'Time' },
    { id: 'difficulty', width: '7rem', priority: 50, tier: 'detail', label: 'Difficulty' },
    { id: 'date', width: '8rem', priority: 30, tier: 'detail', label: 'Date Set' },
    { id: 'actions', width: '8.5rem', priority: 40, tier: 'detail', label: 'Actions' },
]

const UNTIERED: ResponsiveColumn[] = RECORDS.map(({ id, width, priority, required }) => ({ id, width, priority, required }))

const shown = (ids: Set<string>) => [...ids].sort()

describe('desktop keeps priority dropping', () => {
    const desktop = { touch: false, tiered: true }

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
})

describe('touch shows the whole table or cards', () => {
    const touch = { touch: true, tiered: true }
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

    it('counts a column without a tier as one that must show', () => {
        const columns = RECORDS.map(column => column.id === 'date' ? { ...column, tier: undefined } : column)
        expect(resolveTableLayout(columns, 50, touch).table).toBe(false)
    })

    it('leaves an untiered table on the desktop rule', () => {
        const layout = resolveTableLayout(UNTIERED, 50, { touch: true, tiered: false })
        expect(layout.table).toBe(true)
        expect(shown(layout.hiddenIds)).toEqual(['date'])
    })

    it('treats an unmeasured container as fitting', () => {
        expect(resolveTableLayout(RECORDS, 0, touch).table).toBe(true)
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
        { id: 'since', width: '8rem', label: 'Since' },
    ]

    it('puts detail columns in the expand panel, in display order', () => {
        expect(cardPanelColumns(RUSHERS).map(column => column.label)).toEqual(['Median WR', 'Average WR', 'Since'])
    })

    it('keeps essential and decorative columns out of the panel', () => {
        expect(cardPanelColumns(RECORDS).map(column => column.id)).toEqual(['difficulty', 'date', 'actions'])
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

    it('offers no card sort for a table without sortable columns', () => {
        expect(cardSortFields(RUSHERS)).toEqual([])
    })
})
