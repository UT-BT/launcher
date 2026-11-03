import type { Page } from '@playwright/test'

export interface ViewportBox {
    left: number
    top: number
    width: number
    height: number
    scale: number
}

export interface MobileProbe {
    visualViewport(): ViewportBox
    rendered(element: Element): boolean
    describe(element: Element): string
    outside(element: Element, area: ViewportBox): string | null
    listed(lines: string[], limit?: number): string[]
    within(root: string | null, selector: string): Element[]
}

declare global {
    interface Window {
        __mobileProbe: MobileProbe
    }
}

function defineProbe() {
    const probe: MobileProbe = {
        visualViewport() {
            const viewport = window.visualViewport
            if (!viewport) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, scale: 1 }
            return { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height, scale: viewport.scale }
        },
        rendered(element) {
            if (element.closest('[inert], [aria-hidden="true"]')) return false
            const visible = element.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true } as CheckVisibilityOptions)
            if (!visible) return false
            const rect = element.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
        },
        describe(element) {
            const labels = 'labels' in element ? (element as HTMLInputElement).labels : null
            const text = element.getAttribute('aria-label')
                || labels?.[0]?.textContent
                || element.getAttribute('title')
                || element.getAttribute('placeholder')
                || (element.tagName === 'SELECT' ? '' : element.textContent)
                || element.getAttribute('name')
                || ''
            const name = text.trim().replace(/\s+/g, ' ').slice(0, 40)
            const kind = element.getAttribute('role') || element.tagName.toLowerCase()
            return name ? `${kind} "${name}"` : kind
        },
        outside(element, area) {
            const rect = element.getBoundingClientRect()
            const tolerance = 1
            const fits = rect.left >= area.left - tolerance
                && rect.top >= area.top - tolerance
                && rect.right <= area.left + area.width + tolerance
                && rect.bottom <= area.top + area.height + tolerance
            if (fits) return null
            const round = (value: number) => Math.round(value)
            return `${probe.describe(element)} spans ${round(rect.left)},${round(rect.top)} to ${round(rect.right)},${round(rect.bottom)}, outside the visible ${round(area.left)},${round(area.top)} to ${round(area.left + area.width)},${round(area.top + area.height)}`
        },
        within(root, selector) {
            const roots = root ? [...document.querySelectorAll(root)] : [document.documentElement]
            return roots.flatMap(scope => [...scope.querySelectorAll(selector)])
        },
        listed(lines, limit = 12) {
            return lines.length > limit ? [...lines.slice(0, limit), `…and ${lines.length - limit} more`] : lines
        },
    }
    window.__mobileProbe = probe
}

export async function installProbe(page: Page) {
    await page.evaluate(defineProbe)
}
