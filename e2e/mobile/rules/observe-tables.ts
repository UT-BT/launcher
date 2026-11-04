import type { Page, ViewportSize } from '@playwright/test'
import { settleLayout } from '../settle'
import type { Content, DesktopTable, ObservedTable, TableColumn, Token, TouchTable } from '../tables'
import { measuredRoot, type RuleContext } from './types'

const DESKTOP_SIZE: ViewportSize = { width: 1920, height: 1080 }
const ROWS_COMPARED = 3

const CARD_MARK = 'data-mobile-crawl-card'
const EXPAND_MARK = 'data-mobile-crawl-expand'
const WAIT_MS = 10_000
const QUIET_MS = 400

interface TableReader {
    keepScroll(): void
    restoreScroll(): void
    desktop(root: string | null, rows: number): DesktopTable[]
    touch(count: number, rows: number): TouchTable[]
    expandControls(): number
    cards(): Content[][]
    unmark(): void
}

declare global {
    interface Window {
        __mobileTables: TableReader
    }
}

function defineTableReader({ cardMark, expandMark }: { cardMark: string; expandMark: string }) {
    const probe = window.__mobileProbe
    const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
    const meaningful = (value: string) => /[\p{L}\p{N}]/u.test(value)
    const shown = (element: Element) => element.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)
    const nameOf = (element: Element) => clean(element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('alt') || '')
    const unique = <T,>(values: T[]) => [...new Set(values)]
    const controls = 'button, a[href], [role="button"], [role="link"]'
    const labelled = '[aria-label], [title], img[alt]'
    const views = 'table, [role="list"]'
    let kept: [Element, number, number][] = []
    let keptWindow: [number, number] = [0, 0]
    let placed: { shell: Element; position: number }[] = []

    const headersOf = (table: HTMLTableElement) => {
        const rows = table.tHead?.rows
        const cells = rows?.length ? [...rows[rows.length - 1].cells] : []
        return cells.map((cell, index) => ({ cell, index })).filter(({ cell }) => probe.rendered(cell))
    }
    const columnName = (cell: Element, position: number) => {
        const label = clean(cell.textContent ?? '') || nameOf(cell)
        return { name: label || `column ${position + 1}`, labelled: !!label }
    }
    const bodyRows = (table: HTMLTableElement, cells: number, limit: number) => [...table.tBodies]
        .flatMap(body => [...body.rows])
        .filter(row => row.cells.length === cells && probe.rendered(row))
        .slice(0, limit)
    const iconOf = (control: Element) => [...control.querySelector('svg')?.classList ?? []].find(name => name.startsWith('lucide-')) ?? ''
    const textOf = (element: Element) => clean((element as HTMLElement).innerText)
    const shownControls = (element: Element) => [element, ...element.querySelectorAll(controls)].filter(control => control.matches(controls) && shown(control))
    const cellTokens = (cell: Element | undefined, column: TableColumn): Token[] => {
        if (!cell) return []
        const text = unique((cell as HTMLElement).innerText.split('\n').map(clean).filter(meaningful))
        const iconOnly = shownControls(cell).filter(control => !meaningful(textOf(control)))
        const headerNamesControl = column.labelled && iconOnly.length === 1
        const namedControls = iconOnly
            .map(control => ({ control, names: unique([nameOf(control), iconOf(control), headerNamesControl ? column.name : ''].filter(meaningful)) }))
            .filter(({ names }) => names.length)
        const pictures = text.length ? [] : unique([...cell.querySelectorAll(labelled)]
            .filter(element => shown(element) && !namedControls.some(({ control }) => control.contains(element)))
            .map(nameOf)
            .filter(meaningful))
        return [...text, ...namedControls.map(({ names }) => ({ control: names })), ...pictures]
    }
    const textNodes = (element: Element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const parts: string[] = []
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = clean(node.textContent ?? '')
            if (meaningful(text) && node.parentElement && shown(node.parentElement)) parts.push(text)
        }
        return parts
    }
    const contentOf = (elements: Element[]): Content => ({
        text: [...elements.map(element => (element as HTMLElement).innerText), ...elements.flatMap(textNodes)].join('\n'),
        names: unique(elements.flatMap(element => [element, ...element.querySelectorAll(labelled)]).filter(shown).map(nameOf).filter(meaningful)),
        controls: unique(elements.flatMap(shownControls).flatMap(control => [nameOf(control), textOf(control), iconOf(control)]).filter(meaningful)),
    })
    const outermostViews = (shell: Element) => [...shell.querySelectorAll(views)].filter(view => {
        const holder = view.parentElement?.closest(views)
        return !holder || holder === shell || !shell.contains(holder)
    })

    window.__mobileTables = {
        keepScroll() {
            kept = [...document.querySelectorAll('*')]
                .filter(element => element.scrollTop || element.scrollLeft)
                .map(element => [element, element.scrollTop, element.scrollLeft])
            keptWindow = [window.scrollX, window.scrollY]
        },
        restoreScroll() {
            for (const element of document.querySelectorAll('*')) {
                if ((element.scrollTop || element.scrollLeft) && !kept.some(([saved]) => saved === element)) element.scrollTo(0, 0)
            }
            for (const [element, top, left] of kept) element.scrollTo(left, top)
            window.scrollTo(keptWindow[0], keptWindow[1])
        },
        desktop(root, limit) {
            const tables = probe.within(root, 'table')
                .filter(table => probe.rendered(table) && !table.parentElement?.closest('table')) as HTMLTableElement[]
            placed = tables.map(table => {
                const shell = table.parentElement ?? table
                return { shell, position: outermostViews(shell).indexOf(table) }
            })
            return tables.map(table => {
                const headers = headersOf(table)
                const total = table.tHead?.rows[table.tHead.rows.length - 1]?.cells.length ?? 0
                const columns = headers.map(({ cell }, position) => columnName(cell, position))
                return {
                    columns,
                    rows: bodyRows(table, total, limit).map(row => headers.map(({ index: cell }, position) => cellTokens(row.cells[cell], columns[position]))),
                }
            })
        },
        touch(count, limit) {
            return Array.from({ length: count }, (_, index): TouchTable => {
                const place = placed[index]
                if (!place?.shell.isConnected || !probe.rendered(place.shell)) return { shown: 'nothing' }
                const view = outermostViews(place.shell)[place.position]
                if (!view || !probe.rendered(view)) return { shown: 'nothing' }
                if (view instanceof HTMLTableElement) {
                    const total = view.tHead?.rows[view.tHead.rows.length - 1]?.cells.length ?? 0
                    return {
                        shown: 'table',
                        headers: headersOf(view).map(({ cell }, position) => columnName(cell, position).name),
                        rows: bodyRows(view, total, limit).map(row => contentOf([row])),
                    }
                }
                const items = '[role="listitem"], li'
                const cards = [...view.querySelectorAll(items)]
                    .filter(card => !card.parentElement?.closest(items) || !view.contains(card.parentElement.closest(items)))
                    .filter(card => probe.rendered(card))
                    .slice(0, limit)
                cards.forEach((card, position) => card.setAttribute(cardMark, `${index}:${position}`))
                return { shown: 'cards', cards: [] }
            })
        },
        expandControls() {
            const disclosures = `:is(button, [role="button"])[aria-expanded="false"]:not([aria-haspopup])`
            const collapsed = [...document.querySelectorAll(`[${cardMark}] ${disclosures}`)].filter(control => probe.rendered(control))
            collapsed.forEach((control, index) => control.setAttribute(expandMark, String(index)))
            return collapsed.length
        },
        cards() {
            const byTable = new Map<number, Content[]>()
            for (const card of document.querySelectorAll(`[${cardMark}]`)) {
                const [table, position] = (card.getAttribute(cardMark) ?? '').split(':').map(Number)
                const panels = [...card.querySelectorAll('[aria-expanded="true"][aria-controls]')]
                    .flatMap(control => (control.getAttribute('aria-controls') ?? '').split(/\s+/))
                    .map(id => document.getElementById(id))
                    .filter((panel): panel is HTMLElement => !!panel && !card.contains(panel) && probe.rendered(panel))
                const contents = byTable.get(table) ?? []
                contents[position] = contentOf([card, ...panels])
                byTable.set(table, contents)
            }
            const last = Math.max(-1, ...byTable.keys())
            return Array.from({ length: last + 1 }, (_, table) => byTable.get(table) ?? [])
        },
        unmark() {
            placed = []
            for (const mark of [cardMark, expandMark]) {
                for (const element of document.querySelectorAll(`[${mark}]`)) element.removeAttribute(mark)
            }
        },
    }
}

async function resizeTo(page: Page, size: ViewportSize) {
    await page.setViewportSize(size)
    await settleLayout(page)
    await page.evaluate(() => { delete (window as unknown as { __mobileTablesQuiet?: unknown }).__mobileTablesQuiet })
    await page.waitForFunction(quietMs => {
        const signature = [
            document.documentElement.scrollWidth,
            document.documentElement.scrollHeight,
            document.getElementsByTagName('*').length,
            document.getElementsByTagName('table').length,
        ].join()
        const state = window as unknown as { __mobileTablesQuiet?: { signature: string; since: number } }
        const now = performance.now()
        if (state.__mobileTablesQuiet?.signature !== signature) state.__mobileTablesQuiet = { signature, since: now }
        return now - state.__mobileTablesQuiet.since >= quietMs
    }, QUIET_MS, { polling: 'raf', timeout: WAIT_MS })
}

async function readCards(page: Page): Promise<Content[][]> {
    return page.evaluate(() => window.__mobileTables.cards())
}

async function expandCards(page: Page, faces: Content[][]): Promise<{ expanded: number[]; cards: Content[][] }> {
    const count = await page.evaluate(() => window.__mobileTables.expandControls())
    const expanded: number[] = []
    let cards = faces
    for (let index = 0; index < count; index++) {
        const control = page.locator(`[${EXPAND_MARK}="${index}"]`)
        const state = await control.getAttribute('aria-expanded', { timeout: WAIT_MS }).catch(() => null)
        if (state !== 'false') continue
        await control.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => undefined)
        const opened = await control.tap({ timeout: WAIT_MS })
            .then(() => page.locator(`[${EXPAND_MARK}="${index}"][aria-expanded="true"]`).waitFor({ state: 'attached', timeout: WAIT_MS }))
            .then(() => true, () => false)
        if (!opened) continue
        expanded.push(index)
        await settleLayout(page)
        cards = withCardFaces(cards, await readCards(page))
    }
    return { expanded, cards }
}

async function collapseCards(page: Page, expanded: number[]) {
    for (const index of [...expanded].reverse()) {
        const control = page.locator(`[${EXPAND_MARK}="${index}"][aria-expanded="true"]`)
        if (!await control.count()) continue
        await control.tap({ timeout: WAIT_MS }).catch(() => control.evaluate(element => (element as HTMLElement).click()).catch(() => undefined))
        if (await control.count()) throw new Error(`expand control ${index + 1} in the cards stayed open after the crawl closed it`)
    }
}

function withCardFaces(faces: Content[][], opened: Content[][]): Content[][] {
    return Array.from({ length: Math.max(faces.length, opened.length) }, (_, table) => {
        const before = faces[table] ?? []
        const after = opened[table] ?? []
        return Array.from({ length: Math.max(before.length, after.length) }, (_, position) => {
            const face = before[position]
            const open = after[position]
            if (!face || !open) return face ?? open
            return { text: `${face.text}\n${open.text}`, names: [...face.names, ...open.names], controls: [...face.controls, ...open.controls] }
        })
    })
}

async function read(page: Page, surface: RuleContext['surface'], size: ViewportSize): Promise<ObservedTable[]> {
    await page.evaluate(defineTableReader, { cardMark: CARD_MARK, expandMark: EXPAND_MARK })
    await page.evaluate(() => window.__mobileTables.keepScroll())
    await resizeTo(page, DESKTOP_SIZE)
    const desktop = await page.evaluate(({ root, rows }) => window.__mobileTables.desktop(root, rows), { root: measuredRoot(surface), rows: ROWS_COMPARED })
    await resizeTo(page, size)
    if (!desktop.length) return []
    const touch = await page.evaluate(({ count, rows }) => window.__mobileTables.touch(count, rows), { count: desktop.length, rows: ROWS_COMPARED })
    const { expanded, cards } = await expandCards(page, await readCards(page))
    await collapseCards(page, expanded)
    return desktop.map((table, index) => {
        const touchTable = touch[index]
        return { desktop: table, touch: touchTable.shown === 'cards' ? { shown: 'cards', cards: cards[index] ?? [] } : touchTable }
    })
}

async function restore(page: Page, size: ViewportSize) {
    if (page.isClosed()) return
    const now = page.viewportSize()
    if (now?.width !== size.width || now?.height !== size.height) await resizeTo(page, size)
    await page.evaluate(() => {
        if (!('__mobileTables' in window)) return
        window.__mobileTables.unmark()
        window.__mobileTables.restoreScroll()
    })
    await settleLayout(page)
}

async function observe({ page, surface }: RuleContext): Promise<ObservedTable[]> {
    const size = page.viewportSize()
    if (!size) throw new Error('the page has no fixed viewport to widen')
    const tables = await read(page, surface, size).catch(async (error: unknown) => {
        await restore(page, size).catch(() => undefined)
        throw error
    })
    await restore(page, size)
    return tables
}

const observations = new WeakMap<Page, Promise<ObservedTable[]>>()

export function observeTables(context: RuleContext): Promise<ObservedTable[]> {
    const known = observations.get(context.page)
    if (known) return known
    const pending = observe(context)
    observations.set(context.page, pending)
    return pending
}
