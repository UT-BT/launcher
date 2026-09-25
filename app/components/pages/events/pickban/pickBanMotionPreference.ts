const STORAGE_KEY = 'utbt:pickBanMotion:v1'

export function isStreamMotionOff(search: string): boolean {
    return new URLSearchParams(search).get('motion') === '0'
}

export function parsePickBanMotion(raw: string | null): boolean {
    return raw !== 'off'
}

export function loadPickBanMotion(): boolean {
    try {
        return parsePickBanMotion(window.localStorage.getItem(STORAGE_KEY))
    } catch {
        return true
    }
}

export function savePickBanMotion(animate: boolean): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, animate ? 'on' : 'off')
    } catch {
        return
    }
}
