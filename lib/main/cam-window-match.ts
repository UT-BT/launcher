export interface TopLevelWindow<Handle> {
    handle: Handle
    pid: number
    visible: boolean
    owned: boolean
    title: string
    className: string
}

const VIEWPORT_CLASS = /ViewportWindow$/i
const GAME_TITLE = /Unreal Tournament/i

export function pickCamWindow<Handle>(
    windows: readonly TopLevelWindow<Handle>[],
    pid: number,
    expectedTitle: string,
): TopLevelWindow<Handle> | null {
    const candidates = windows.filter(window => window.pid === pid && window.visible && !window.owned)
    return candidates.find(window => window.title === expectedTitle)
        ?? candidates.find(window => VIEWPORT_CLASS.test(window.className))
        ?? candidates.find(window => GAME_TITLE.test(window.title))
        ?? candidates[0]
        ?? null
}
