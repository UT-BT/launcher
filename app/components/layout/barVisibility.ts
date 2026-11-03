const BAR_SCROLL_THRESHOLD_PX = 16
const USER_SCROLL_WINDOW_MS = 300

export interface BarVisibility {
    visible: boolean
    anchor: number
    top: number
    inputUntil: number
}

export interface ShellScroll {
    top: number
    max: number
    now: number
}

export function barsShownAt(top: number): BarVisibility {
    return { visible: true, anchor: top, top, inputUntil: Number.NEGATIVE_INFINITY }
}

export function barsAfterInput(state: BarVisibility, now: number): BarVisibility {
    return { ...state, inputUntil: now + USER_SCROLL_WINDOW_MS }
}

export function barsAfterScroll(state: BarVisibility, { top, max, now }: ShellScroll): BarVisibility {
    const position = Math.max(0, Math.min(top, max))
    const byUser = now <= state.inputUntil
    const inputUntil = byUser ? now + USER_SCROLL_WINDOW_MS : state.inputUntil
    if (position === state.top) return { ...state, inputUntil }
    if (position <= BAR_SCROLL_THRESHOLD_PX) return { visible: true, anchor: position, top: position, inputUntil }
    if (!byUser) return { ...state, anchor: position, top: position }
    const towardToggle = state.visible ? position - state.anchor : state.anchor - position
    if (towardToggle > BAR_SCROLL_THRESHOLD_PX) {
        return { visible: !state.visible, anchor: position, top: position, inputUntil }
    }
    return { visible: state.visible, anchor: towardToggle < 0 ? position : state.anchor, top: position, inputUntil }
}
