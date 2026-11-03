const FOCUSABLE = [
    'a[href]',
    'area[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'iframe',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]',
].join(', ')

let pressed: HTMLElement | null = null
let focusOrigin: HTMLElement | null = null

if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', event => {
        pressed = event.target instanceof Element ? event.target.closest<HTMLElement>(FOCUSABLE) : null
    }, true)

    document.addEventListener('keydown', () => { pressed = null }, true)

    document.addEventListener('focusin', event => {
        focusOrigin = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null
    }, true)
}

function rendered(element: HTMLElement): boolean {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

export function tabbableIn(panel: HTMLElement): HTMLElement[] {
    return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element =>
        element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && rendered(element))
}

export function isTopMostModal(panel: HTMLElement): boolean {
    const backdrops = document.querySelectorAll('[data-modal-backdrop]')
    return backdrops[backdrops.length - 1] === panel.parentElement
}

function canReturnTo(element: Element | null, panel: HTMLElement): element is HTMLElement {
    return element instanceof HTMLElement && element.isConnected && element !== document.body && !panel.contains(element)
}

export function openerOf(panel: HTMLElement): HTMLElement | null {
    const active = document.activeElement
    const focusedBefore = active !== null && panel.contains(active) ? focusOrigin : active
    const pressedInside = pressed !== null && focusedBefore?.contains(pressed)
    const candidates = pressedInside ? [pressed, focusedBefore] : [focusedBefore, pressed]
    return candidates.find(candidate => canReturnTo(candidate, panel)) ?? null
}

export function focusFirst(panel: HTMLElement) {
    const [first] = tabbableIn(panel)
    ;(first ?? panel).focus({ preventScroll: true })
}

function follows(element: Node, reference: Node): boolean {
    return (reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

export function trapTab(event: KeyboardEvent, panel: HTMLElement) {
    const tabbable = tabbableIn(panel)
    const active = document.activeElement
    const focusInPanel = active !== null && active !== panel && panel.contains(active)
    const browserStaysInPanel = focusInPanel && tabbable.some(element =>
        event.shiftKey ? follows(active, element) : follows(element, active))
    if (browserStaysInPanel) return
    event.preventDefault()
    const wrapTarget = event.shiftKey ? tabbable.at(-1) : tabbable[0]
    ;(wrapTarget ?? panel).focus({ preventScroll: true })
}

export function returnFocus(opener: HTMLElement | null, panel: HTMLElement) {
    const active = document.activeElement
    const focusWasInModal = !active || active === document.body || panel.contains(active)
    if (opener?.isConnected && focusWasInModal) opener.focus({ preventScroll: true })
}
