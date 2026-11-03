import type { Page } from '@playwright/test'
import { settleLayout } from './settle'

export type ScrollerPath = 'window' | 'main' | number[]

export interface ScrollMove {
    scroller: string
    path: ScrollerPath
    from: number
    to: number
}

export interface ModalCheck {
    open: boolean
    problems: string[]
    close: { x: number; y: number; reachable: boolean } | null
}

const CLOSE_NAME = '^close\\b'
const WAIT_MS = 5000

export type SwipeReach = 'chain' | 'page'

export async function swipeScroll(page: Page, deltaY: number, reach: SwipeReach = 'chain'): Promise<ScrollMove[]> {
    return page.evaluate(({ delta, reach }) => {
        const probe = window.__mobileProbe
        const area = probe.visualViewport()
        const root = document.scrollingElement ?? document.documentElement
        const main = document.querySelector('main')
        const blocked = (value: string) => value === 'hidden' || value === 'clip'
        const viewportOverflow = () => {
            const html = getComputedStyle(document.documentElement).overflowY
            return html === 'visible' ? getComputedStyle(document.body).overflowY : html
        }
        const userScrollable = (element: Element) => {
            if (element === root) return !blocked(viewportOverflow()) && root.scrollHeight > root.clientHeight
            if (element === document.body && getComputedStyle(document.documentElement).overflowY === 'visible') return false
            const overflow = getComputedStyle(element).overflowY
            return (overflow === 'auto' || overflow === 'scroll') && element.scrollHeight > element.clientHeight
        }
        const pathOf = (element: Element): ScrollerPath => {
            if (element === root) return 'window'
            if (element === main) return 'main'
            const path: number[] = []
            for (let node: Element | null = element; node && node !== main && node.parentElement; node = node.parentElement) {
                path.unshift([...node.parentElement.children].indexOf(node))
            }
            return path
        }
        const nameOf = (element: Element) => element === root ? 'the window' : element === main ? 'the shell scroller (main)' : `an inner scroller (${probe.describe(element)})`
        const chain: Element[] = []
        let node: Element | null = document.elementFromPoint(area.left + area.width / 2, area.top + area.height / 2)
        while (node) {
            if (userScrollable(node)) chain.push(node)
            if (node === root) break
            node = getComputedStyle(node).position === 'fixed' ? root : (node.parentElement ?? root)
        }
        const moves: ScrollMove[] = []
        let remaining = delta
        for (const scroller of reach === 'page' ? chain.slice(-1) : chain) {
            if (Math.abs(remaining) < 1) break
            const from = scroller.scrollTop
            scroller.scrollTo({ top: from + remaining, behavior: 'instant' })
            const used = scroller.scrollTop - from
            if (Math.abs(used) >= 1) moves.push({ scroller: nameOf(scroller), path: pathOf(scroller), from: Math.round(from), to: Math.round(scroller.scrollTop) })
            remaining -= used
        }
        return moves
    }, { delta: deltaY, reach })
}

export async function scrollToTop(page: Page): Promise<ScrollMove[]> {
    const moves = await swipeScroll(page, -1_000_000)
    await settleLayout(page)
    return moves
}

export async function swipeOneViewport(page: Page): Promise<ScrollMove[]> {
    const area = await page.evaluate(() => window.__mobileProbe.visualViewport())
    const moves = await swipeScroll(page, Math.round(area.height), 'page')
    await settleLayout(page)
    return moves
}

export async function scrollDownThenToTop(page: Page): Promise<ScrollMove[]> {
    const moves = await swipeOneViewport(page)
    await scrollToTop(page)
    return moves
}

export async function stuckPageProblems(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const main = document.querySelector('main')
        if (!main || main.scrollHeight <= main.clientHeight + 1) return []
        return [`a swipe scrolls nothing, though the shell scroller (main) holds ${main.scrollHeight - main.clientHeight}px more than it shows`]
    })
}

export async function scrollerTop(page: Page, path: ScrollerPath): Promise<number | null> {
    return page.evaluate(target => {
        if (target === 'window') return window.scrollY
        const main = document.querySelector('main')
        if (!main) return null
        if (target === 'main') return main.scrollTop
        let node: Element | undefined = main
        for (const index of target) node = node?.children[index]
        return node ? node.scrollTop : null
    }, path)
}

export async function scrollPositionProblems(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const probe = window.__mobileProbe
        const area = probe.visualViewport()
        const found: string[] = []
        if (Math.abs(window.scrollX) > 0.5 || Math.abs(window.scrollY) > 0.5) found.push(`the window is scrolled to ${Math.round(window.scrollX)},${Math.round(window.scrollY)}`)
        if (Math.abs(area.left) > 0.5 || Math.abs(area.top) > 0.5) found.push(`the visual viewport is offset to ${Math.round(area.left)},${Math.round(area.top)}`)
        const main = document.querySelector('main')
        if (!main) return [...found, 'there is no main element']
        if (main.scrollTop > 0.5) found.push(`the shell scroller (main) is at ${Math.round(main.scrollTop)}px`)
        for (const element of main.querySelectorAll('*')) {
            if (element.scrollTop > 0.5 && probe.rendered(element)) found.push(`an inner scroller (${probe.describe(element)}) is at ${Math.round(element.scrollTop)}px`)
        }
        return found
    })
}

export async function topOfPageProblems(page: Page): Promise<string[]> {
    const positions = await scrollPositionProblems(page)
    const header = await page.evaluate(() => {
        const probe = window.__mobileProbe
        const area = probe.visualViewport()
        const found: string[] = []
        const main = document.querySelector('main')
        if (!main) return ['there is no main element']
        const showsContent = (element: Element) => element.matches('img, video, canvas, svg, h1, h2, h3, h4, h5, h6')
            || [...element.childNodes].some(child => child.nodeType === Node.TEXT_NODE && !!child.textContent?.trim())
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT)
        let first: Element | null = null
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const element = node as Element
            if (!showsContent(element) || !probe.rendered(element)) continue
            const rect = element.getBoundingClientRect()
            if (rect.width < 2 || rect.height < 2) continue
            first = element
            break
        }
        if (!first) return ['the page shows nothing']
        const rect = first.getBoundingClientRect()
        if (rect.top < area.top - 1 || rect.top > area.top + area.height) {
            found.push(`the top of the page header ${probe.describe(first)} is at ${Math.round(rect.top)}, outside the visible ${Math.round(area.top)} to ${Math.round(area.top + area.height)}`)
        } else {
            const y = rect.top + Math.min(rect.height / 2, 12)
            const hit = document.elementFromPoint(rect.left + rect.width / 2, y)
            if (!hit || !main.contains(hit) || !(first.contains(hit) || hit.contains(first))) {
                found.push(`the page header ${probe.describe(first)} is covered by ${hit ? probe.describe(hit) : 'nothing on screen'}`)
            }
        }
        if (!window.matchMedia('(min-width: 1024px)').matches) {
            const menu = document.querySelector('button[aria-label="Open navigation"]')
            if (!menu || !probe.rendered(menu)) found.push('the hamburger is not rendered')
            else {
                const outside = probe.outside(menu, area)
                if (outside) found.push(`hamburger: ${outside}`)
                else {
                    const rect = menu.getBoundingClientRect()
                    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                    if (!hit || !menu.contains(hit)) found.push(`the hamburger is covered by ${hit ? probe.describe(hit) : 'nothing on screen'}`)
                }
            }
        }
        return found
    })
    return [...positions, ...header]
}

export async function checkModal(page: Page, root: string): Promise<ModalCheck> {
    return page.evaluate(({ selector, closeName }) => {
        const probe = window.__mobileProbe
        const area = probe.visualViewport()
        const roots = [...document.querySelectorAll(selector)].filter(element => probe.rendered(element))
        const top = roots.at(-1)
        if (!top) return { open: false, problems: [`the modal is not open: nothing matches ${selector}`], close: null }
        const problems: string[] = []
        const panel = [...top.children].find(child => probe.rendered(child)) ?? top
        const panelOutside = probe.outside(panel, area)
        if (panelOutside) problems.push(`modal box: ${panelOutside}`)
        const box = panel.getBoundingClientRect()
        const left = Math.max(box.left, area.left)
        const right = Math.min(box.right, area.left + area.width)
        const edges = [['top', Math.max(box.top, area.top) + 2], ['bottom', Math.min(box.bottom, area.top + area.height) - 2]] as const
        for (const [edge, y] of edges) {
            const covers = new Set<string>()
            for (const x of [left + 12, (left + right) / 2, right - 12]) {
                const hit = document.elementFromPoint(x, y)
                if (!hit || !panel.contains(hit)) covers.add(hit ? probe.describe(hit) : 'nothing on screen')
            }
            if (covers.size) problems.push(`the modal box's ${edge} edge is covered by ${[...covers].join(', ')}`)
        }
        const pattern = new RegExp(closeName, 'i')
        const control = [...top.querySelectorAll('button, [role="button"]')]
            .filter(element => probe.rendered(element))
            .find(element => pattern.test((element.getAttribute('aria-label') || element.textContent || '').trim()))
        if (!control) return { open: true, problems: [...problems, 'the modal has no rendered close control'], close: null }
        const rect = control.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const outside = probe.outside(control, area)
        if (outside) problems.push(`close control: ${outside}`)
        const hit = document.elementFromPoint(x, y)
        const hitsControl = !!hit && control.contains(hit)
        if (!hitsControl) problems.push(`the close control ${probe.describe(control)} is covered by ${hit ? probe.describe(hit) : 'nothing on screen'}`)
        return { open: true, problems, close: { x, y, reachable: !outside && hitsControl } }
    }, { selector: root, closeName: CLOSE_NAME })
}

async function modalGone(page: Page, root: string): Promise<boolean> {
    return page.waitForFunction(selector => {
        const probe = window.__mobileProbe
        return ![...document.querySelectorAll(selector)].some(element => probe.rendered(element))
    }, root, { timeout: WAIT_MS }).then(() => true, () => false)
}

export async function closeModal(page: Page, root: string): Promise<{ closed: boolean; notes: string[] }> {
    const check = await checkModal(page, root)
    if (!check.open) return { closed: true, notes: [] }
    const notes: string[] = []
    if (check.close?.reachable) {
        await page.touchscreen.tap(check.close.x, check.close.y)
        if (await modalGone(page, root)) {
            await settleLayout(page)
            return { closed: true, notes }
        }
        notes.push('tapping the close control did not close the modal')
    } else {
        notes.push('the close control cannot be tapped, so the modal was closed with Escape')
    }
    await page.keyboard.press('Escape')
    const closed = await modalGone(page, root)
    if (!closed) notes.push('Escape did not close the modal either')
    await settleLayout(page)
    return { closed, notes }
}

export async function rotate(page: Page): Promise<string> {
    const size = page.viewportSize()
    if (!size) throw new Error('the page has no fixed viewport to rotate')
    await page.setViewportSize({ width: size.height, height: size.width })
    await settleLayout(page)
    return `${size.height}x${size.width}`
}

export async function zoomVisualViewport(page: Page, scale: number): Promise<boolean> {
    if (page.context().browser()?.browserType().name() !== 'chromium') return false
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: scale })
    await session.detach()
    await page.waitForFunction(expected => Math.abs((window.visualViewport?.scale ?? 1) - expected) < 0.01, scale, { polling: 'raf', timeout: WAIT_MS })
    await settleLayout(page)
    return true
}

export async function tapCentre(page: Page, selector: string): Promise<string | null> {
    const point = await page.evaluate(target => {
        const probe = window.__mobileProbe
        const element = [...document.querySelectorAll(target)].find(candidate => probe.rendered(candidate))
        if (!element) return null
        const rect = element.getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        const hit = document.elementFromPoint(x, y)
        return { x, y, cover: hit && element.contains(hit) ? null : (hit ? probe.describe(hit) : 'nothing on screen') }
    }, selector)
    if (!point) return `nothing rendered matches ${selector}`
    if (point.cover) return `${selector} is covered by ${point.cover}`
    await page.touchscreen.tap(point.x, point.y)
    return null
}
