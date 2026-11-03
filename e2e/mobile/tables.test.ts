import { describe, expect, it } from 'vitest'
import { cardColumnsResult, contains, tableColumnsResult, type Content, type ObservedTable } from './tables'

const MAPS: ObservedTable['desktop'] = {
    columns: [
        { name: 'column 1', labelled: false },
        { name: 'Map', labelled: true },
        { name: 'Author', labelled: true },
        { name: 'Difficulty', labelled: true },
    ],
    rows: [
        [['thumbnail of Alpha'], ['CTF-BT-Alpha'], ['Mapper One'], ['3']],
    ],
}

describe('a table on touch shows every non-decorative column', () => {
    it('passes a table that keeps every desktop column', () => {
        const tables: ObservedTable[] = [{
            desktop: MAPS,
            touch: { shown: 'table', headers: ['column 1', 'Map', 'Author', 'Difficulty'], rows: [{ text: 'thumbnail of Alpha CTF-BT-Alpha Mapper One 3', names: [], controls: [] }] },
        }]
        expect(tableColumnsResult(tables, [])).toEqual({ status: 'pass', detail: [] })
    })

    it('fails a cut-down table and names the columns it dropped', () => {
        const tables: ObservedTable[] = [{
            desktop: MAPS,
            touch: { shown: 'table', headers: ['column 1', 'Map'], rows: [{ text: 'thumbnail of Alpha CTF-BT-Alpha', names: [], controls: [] }] },
        }]
        expect(tableColumnsResult(tables, [])).toEqual({
            status: 'fail',
            detail: ['the table with Map, Author, Difficulty shows 2 of its 4 non-decorative desktop columns on touch; missing: Author, Difficulty'],
        })
    })

    it('counts only the non-decorative columns in a cut-down table', () => {
        const tables: ObservedTable[] = [{
            desktop: MAPS,
            touch: { shown: 'table', headers: ['Map'], rows: [{ text: 'CTF-BT-Alpha', names: [], controls: [] }] },
        }]
        expect(tableColumnsResult(tables, ['column 1']).detail).toEqual([
            'the table with Map, Author, Difficulty shows 1 of its 3 non-decorative desktop columns on touch; missing: Author, Difficulty',
        ])
    })

    it('lets a declared decorative column go, whatever its case', () => {
        const tables: ObservedTable[] = [{
            desktop: MAPS,
            touch: { shown: 'table', headers: ['Map', 'Author', 'Difficulty'], rows: [{ text: 'CTF-BT-Alpha Mapper One 3', names: [], controls: [] }] },
        }]
        expect(tableColumnsResult(tables, ['Column 1'])).toEqual({ status: 'pass', detail: [] })
    })

    it('finds an unlabelled column by its cell content, not its position', () => {
        const desktop: ObservedTable['desktop'] = {
            columns: [{ name: 'Map', labelled: true }, { name: 'column 2', labelled: false }],
            rows: [[['CTF-BT-Alpha'], ['Download demo']]],
        }
        const kept: ObservedTable = { desktop, touch: { shown: 'table', headers: ['Map', 'column 2'], rows: [{ text: 'CTF-BT-Alpha', names: ['Download demo'], controls: [] }] } }
        const dropped: ObservedTable = { desktop, touch: { shown: 'table', headers: ['Map', 'column 2'], rows: [{ text: 'CTF-BT-Alpha', names: ['Favorite'], controls: [] }] } }
        expect(tableColumnsResult([kept], []).status).toBe('pass')
        expect(tableColumnsResult([dropped], []).detail).toEqual([
            'the table with Map shows 1 of its 2 non-decorative desktop columns on touch; missing: column 2',
        ])
    })

    it('fails a table that shows neither a table nor cards on touch', () => {
        expect(tableColumnsResult([{ desktop: MAPS, touch: { shown: 'nothing' } }], [])).toEqual({
            status: 'fail',
            detail: ['the table with Map, Author, Difficulty shows neither a table nor cards on touch'],
        })
    })

    it('does not apply when every table renders cards, or there is no table', () => {
        expect(tableColumnsResult([{ desktop: MAPS, touch: { shown: 'cards', cards: [] } }], []).status).toBe('n/a')
        expect(tableColumnsResult([], []).status).toBe('n/a')
    })
})

describe('cards on touch expose every non-decorative column', () => {
    const cards = (...contents: Content[]): ObservedTable => ({ desktop: MAPS, touch: { shown: 'cards', cards: contents } })

    it('passes when card N holds every value of desktop row N, on its face or in its panel', () => {
        const card = { text: 'CTF-BT-Alpha Difficulty 3 Author Mapper One', names: ['thumbnail of Alpha'], controls: [] }
        expect(cardColumnsResult([cards(card)], [])).toEqual({ status: 'pass', detail: [] })
    })

    it('fails a card that leaves out a column, naming the value it misses', () => {
        const card = { text: 'Alpha 3', names: [], controls: [] }
        expect(cardColumnsResult([cards(card)], ['column 1'])).toEqual({
            status: 'fail',
            detail: ['the table with Map, Author, Difficulty renders cards on touch; card 1 lacks Map ("CTF-BT-Alpha"), Author ("Mapper One")'],
        })
    })

    it('fails a row with no card', () => {
        expect(cardColumnsResult([cards()], ['column 1']).detail).toEqual([
            'the table with Map, Author, Difficulty renders cards on touch; row 1 has no card',
        ])
    })

    it('does not apply without cards or without rows to compare', () => {
        const table: ObservedTable = { desktop: MAPS, touch: { shown: 'table', headers: [], rows: [] } }
        expect(cardColumnsResult([table], []).status).toBe('n/a')
        expect(cardColumnsResult([{ desktop: { ...MAPS, rows: [] }, touch: { shown: 'cards', cards: [] } }], []).status).toBe('n/a')
    })
})

describe('a value is found only as a whole word', () => {
    const card = (text: string, names: string[] = [], controls: string[] = []): Content => ({ text, names, controls })

    it('does not find a short number inside a longer one or a word', () => {
        expect(contains(card('CTF-BT-Alpha 13 Mapper One'), '3')).toBe(false)
        expect(contains(card('Rank 21'), '1')).toBe(false)
        expect(contains(card('Played 1:05.30'), '5')).toBe(false)
        expect(contains(card('Rating 4.5'), '5')).toBe(false)
        expect(contains(card('Mapper One'), 'one')).toBe(true)
        expect(contains(card('Difficulty 3/5'), '5')).toBe(true)
        expect(contains(card('#1 CTF-BT-Alpha'), '1')).toBe(true)
    })

    it('keeps separate lines apart and treats any run of whitespace as one space', () => {
        expect(contains(card('1\n2'), '12')).toBe(false)
        expect(contains(card('Mapper\n   One'), 'mapper one')).toBe(true)
        expect(contains(card('MapperOne'), 'Mapper One')).toBe(false)
    })

    it('finds a value in a label as a whole word too', () => {
        expect(contains(card('', ['Download demo']), 'download')).toBe(true)
        expect(contains(card('', ['Downloads']), 'download')).toBe(false)
    })

    it('matches a value that starts or ends with punctuation', () => {
        expect(contains(card('Team (Red) wins'), '(Red)')).toBe(true)
        expect(contains(card('W–L 3–1'), '3–1')).toBe(true)
    })

    it('fails a card whose only match for a short value is part of another number', () => {
        const desktop: ObservedTable['desktop'] = {
            columns: [{ name: 'Map', labelled: true }, { name: 'Difficulty', labelled: true }],
            rows: [[['CTF-BT-Alpha'], ['3']]],
        }
        const observed: ObservedTable = { desktop, touch: { shown: 'cards', cards: [card('CTF-BT-Alpha 13 caps')] } }
        expect(cardColumnsResult([observed], []).detail).toEqual([
            'the table with Map, Difficulty renders cards on touch; card 1 lacks Difficulty ("3")',
        ])
    })
})

describe('an icon-only control counts only as a control on the card', () => {
    const desktop: ObservedTable['desktop'] = {
        columns: [{ name: 'Map', labelled: true }, { name: 'Watch', labelled: true }],
        rows: [[['CTF-BT-Alpha'], [{ control: ['lucide-play', 'Watch'] }]]],
    }
    const card = (text: string, controls: string[]): ObservedTable => ({ desktop, touch: { shown: 'cards', cards: [{ text, names: [], controls }] } })

    it('fails a card that only prints the column label', () => {
        expect(cardColumnsResult([card('CTF-BT-Alpha Watch', [])], []).detail).toEqual([
            'the table with Map, Watch renders cards on touch; card 1 lacks Watch (a control named "lucide-play" or "Watch")',
        ])
    })

    it('passes a card with the same icon or a control named after the column', () => {
        expect(cardColumnsResult([card('CTF-BT-Alpha', ['lucide-play'])], []).status).toBe('pass')
        expect(cardColumnsResult([card('CTF-BT-Alpha', ['watch'])], []).status).toBe('pass')
        expect(cardColumnsResult([card('CTF-BT-Alpha', ['lucide-download'])], []).status).toBe('fail')
    })
})
