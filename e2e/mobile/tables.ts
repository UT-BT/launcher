import type { RuleStatus } from './ledger'

export interface TableColumn {
    name: string
    labelled: boolean
}

export interface ControlToken {
    control: string[]
}

export type Token = string | ControlToken

export interface DesktopTable {
    columns: TableColumn[]
    rows: Token[][][]
}

export interface Content {
    text: string
    names: string[]
    controls: string[]
}

export type TouchTable =
    | { shown: 'table'; headers: string[]; rows: Content[] }
    | { shown: 'cards'; cards: Content[] }
    | { shown: 'nothing' }

export interface ObservedTable {
    desktop: DesktopTable
    touch: TouchTable
}

export interface TablesResult {
    status: RuleStatus
    detail: string[]
}

function squash(value: string): string {
    return value.toLowerCase().replace(/\s+/g, '')
}

function sameName(a: string, b: string): boolean {
    return squash(a) === squash(b)
}

function spaced(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

const WORD_EDGE = /^[\p{L}\p{N}]$/u

function wholeWord(token: string): RegExp {
    const wanted = spaced(token)
    const pattern = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const before = WORD_EDGE.test(wanted.at(0) ?? '') ? String.raw`(?<![\p{L}\p{N}]|\p{N}[.,:])` : ''
    const after = WORD_EDGE.test(wanted.at(-1) ?? '') ? String.raw`(?![\p{L}\p{N}]|[.,:]\p{N})` : ''
    return new RegExp(`${before}${pattern}${after}`, 'u')
}

export function contains(content: Content, token: Token): boolean {
    if (typeof token !== 'string') return content.controls.some(name => token.control.some(wanted => sameName(name, wanted)))
    const word = wholeWord(token)
    return [content.text, ...content.names].some(value => word.test(spaced(value)))
}

function describeToken(token: Token): string {
    return typeof token === 'string' ? JSON.stringify(token) : `a control named ${token.control.map(name => JSON.stringify(name)).join(' or ')}`
}

function isDecorative(column: TableColumn, decorative: readonly string[]): boolean {
    return decorative.some(name => sameName(name, column.name))
}

function describeTable(table: DesktopTable): string {
    const labelled = table.columns.filter(column => column.labelled).map(column => column.name)
    return labelled.length ? `the table with ${labelled.slice(0, 3).join(', ')}` : `the table with ${table.columns.length} unlabelled columns`
}

function resultOf(problems: string[]): TablesResult {
    return { status: problems.length ? 'fail' : 'pass', detail: problems }
}

function notApplicable(reason: string): TablesResult {
    return { status: 'n/a', detail: [reason] }
}

function judgedColumns(desktop: DesktopTable, decorative: readonly string[]): { column: TableColumn; index: number }[] {
    return desktop.columns.map((column, index) => ({ column, index })).filter(({ column }) => !isDecorative(column, decorative))
}

function columnShownInTable(desktop: DesktopTable, index: number, touch: { headers: string[]; rows: Content[] }): boolean {
    const column = desktop.columns[index]
    if (column.labelled) return touch.headers.some(header => sameName(header, column.name))
    return desktop.rows.every((row, rowIndex) => {
        const shown = touch.rows[rowIndex]
        return !shown || row[index].every(token => contains(shown, token))
    })
}

export function tableColumnsResult(tables: ObservedTable[], decorative: readonly string[]): TablesResult {
    const judged = tables.filter(({ touch }) => touch.shown !== 'cards')
    if (!judged.length) return notApplicable(tables.length ? 'every table renders cards on touch' : 'no table shows at desktop width')
    const problems: string[] = []
    for (const { desktop, touch } of judged) {
        if (touch.shown === 'nothing') {
            problems.push(`${describeTable(desktop)} shows neither a table nor cards on touch`)
            continue
        }
        if (touch.shown !== 'table') continue
        const columns = judgedColumns(desktop, decorative)
        const missing = columns.filter(({ index }) => !columnShownInTable(desktop, index, touch)).map(({ column }) => column.name)
        if (!missing.length) continue
        problems.push(`${describeTable(desktop)} shows ${columns.length - missing.length} of its ${columns.length} non-decorative desktop columns on touch; missing: ${missing.join(', ')}`)
    }
    return resultOf(problems)
}

function cardProblems(desktop: DesktopTable, cards: Content[], decorative: readonly string[]): string[] {
    const wanted = judgedColumns(desktop, decorative)
    return desktop.rows.flatMap((row, rowIndex) => {
        const card = cards[rowIndex]
        if (!card) return [`row ${rowIndex + 1} has no card`]
        const lacking = wanted.flatMap(({ column, index }) => {
            const missing = row[index].filter(token => !contains(card, token))
            return missing.length ? [`${column.name} (${missing.map(describeToken).join(', ')})`] : []
        })
        return lacking.length ? [`card ${rowIndex + 1} lacks ${lacking.join(', ')}`] : []
    })
}

export function cardColumnsResult(tables: ObservedTable[], decorative: readonly string[]): TablesResult {
    const judged = tables.flatMap(({ desktop, touch }) => touch.shown === 'cards' && desktop.rows.length ? [{ desktop, cards: touch.cards }] : [])
    if (!judged.length) return notApplicable(tables.some(({ touch }) => touch.shown === 'cards') ? 'no desktop rows to compare with the cards' : 'no table renders cards on touch')
    const problems = judged.flatMap(({ desktop, cards }) =>
        cardProblems(desktop, cards, decorative).map(problem => `${describeTable(desktop)} renders cards on touch; ${problem}`))
    return resultOf(problems)
}
