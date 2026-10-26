import { describe, expect, it } from 'vitest'
import { streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import { predictorStandingsRead, withoutMovement, withoutPending } from './predictorStandingsFixtures'
import { predictorStandingsView } from './predictorStandingsView'
import { STANDINGS_BOX } from './predictorStandingsFit'

const rowsOf = (view: ReturnType<typeof predictorStandingsView>) => view.columns.flat()

describe('predictorStandingsView with movement and pending payouts', () => {
    const view = predictorStandingsView(streamSidesFixture('predictorStandings'), STANDINGS_BOX)

    it('says Projected while any payout is pending', () => {
        expect(view.kicker).toBe('Projected')
    })

    it('shows every predictor in rank order, with projected profit, the Pending chip and the won-of-decided record', () => {
        expect(rowsOf(view).map(row => [row.rank, row.name, row.profitText, row.pending, row.record])).toEqual([
            [1, 'Watcher 2001', '+520', true, '3/4'],
            [2, 'Watcher 2002', '+240', false, '2/3'],
            [3, 'Watcher 2003', '+100', true, '2/4'],
            [4, 'Watcher 2007', '+85', true, '1/1'],
            [5, 'Watcher 2004', '0', false, '0/0'],
            [6, 'Watcher 2008', '−60', false, '1/2'],
            [7, 'Watcher 2005', '−300', true, '0/3'],
            [8, 'Watcher 2006', '−330', false, '0/2'],
        ])
        expect(rowsOf(view)[0]).toMatchObject({ userId: '2001', first: true, title: { name: 'Speed Demon', rarity: 5 } })
        expect(rowsOf(view)[1].first).toBe(false)
    })

    it('turns movement into ▲n, ▼n, – and NEW', () => {
        expect(rowsOf(view).map(row => row.move)).toEqual([
            { kind: 'up', text: '▲2' },
            { kind: 'down', text: '▼1' },
            { kind: 'down', text: '▼1' },
            { kind: 'new', text: 'New' },
            { kind: 'down', text: '▼1' },
            { kind: 'up', text: '▲1' },
            { kind: 'down', text: '▼1' },
            { kind: 'same', text: '–' },
        ])
    })

    it('sizes every cell from the longest value at the 44 px density, with titles on the roomy rows', () => {
        expect(view.fit).toMatchObject({ rowHeight: 44, columns: 3, perColumn: 3, more: 0 })
        expect(view.density).toMatchObject({ zoomed: true, title: true })
        expect(view.widths).toEqual({ rank: 15, move: 34, profit: 44, chip: 69, record: 29 })
        expect(view.columns.map(column => column.length)).toEqual([3, 3, 2])
        expect(view.more).toBeNull()
    })
})

describe('predictorStandingsView without movement or pending payouts', () => {
    it('drops the kicker and the chip column once every payout is paid', () => {
        const view = predictorStandingsView(withoutPending(streamSidesFixture('predictorStandings')), STANDINGS_BOX)
        expect(view.kicker).toBeNull()
        expect(rowsOf(view).every(row => !row.pending)).toBe(true)
        expect(view.widths.chip).toBe(0)
    })

    it('renders no movement when the API sends none, as on the match-less read, but keeps the movement cell', () => {
        const view = predictorStandingsView(streamSidesFixture('predictorStandingsMatchless'), STANDINGS_BOX)
        expect(view.kicker).toBeNull()
        expect(rowsOf(view).map(row => row.move)).toEqual([null, null, null, null, null])
        expect(view.widths.move).toBe(18)
        expect(rowsOf(view).map(row => row.name)).toEqual(['Watcher 2002', 'Watcher 2001', 'Watcher 2003', 'Watcher 2004', 'Watcher 2006'])
    })

    it('keeps the movement cell empty for a row the API sends without movement, beside rows that have it', () => {
        const read = streamSidesFixture('predictorStandings')
        read.items[1] = { ...read.items[1], movement: null }
        const view = predictorStandingsView(read, STANDINGS_BOX)
        expect(rowsOf(view)[1].move).toBeNull()
        expect(view.widths.move).toBe(34)
    })

    it('shows no movement on a voided focus market', () => {
        const view = predictorStandingsView(withoutMovement(predictorStandingsRead()), STANDINGS_BOX)
        expect(rowsOf(view).every(row => row.move === null)).toBe(true)
        expect(view.widths.move).toBe(18)
    })
})

describe('predictorStandingsView at scale', () => {
    it('lays 52 predictors out column by column, 18 rows to a column', () => {
        const view = predictorStandingsView(predictorStandingsRead(), STANDINGS_BOX)
        expect(view.columns.map(column => column.length)).toEqual([18, 18, 16])
        expect(view.columns[1][0].rank).toBe(19)
        expect(view.columns[2][15].name).toBe('Pogo')
        expect(view.more).toBeNull()
        expect(view.widths).toEqual({ rank: 29, move: 36, profit: 66, chip: 69, record: 48 })
    })

    it('folds the lowest 17 of 120 predictors into "+ 17 more predictors" in the last slot', () => {
        const view = predictorStandingsView(predictorStandingsRead({ count: 120 }), STANDINGS_BOX)
        expect(view.fit).toMatchObject({ rowHeight: 30, columns: 4, perColumn: 26 })
        expect(view.density).toMatchObject({ zoomed: false, title: false })
        expect(view.columns.map(column => column.length)).toEqual([26, 26, 26, 25])
        expect(rowsOf(view)).toHaveLength(103)
        expect(rowsOf(view).at(-1)?.rank).toBe(103)
        expect(view.more).toBe('+ 17 more predictors')
    })

    it('says so when nobody has predicted yet', () => {
        const view = predictorStandingsView(predictorStandingsRead({ items: [] }), STANDINGS_BOX)
        expect(view.empty).toBe(true)
        expect(view.kicker).toBeNull()
        expect(rowsOf(view)).toEqual([])
    })
})
