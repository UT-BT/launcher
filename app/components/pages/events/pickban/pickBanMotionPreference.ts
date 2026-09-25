import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'

const STORAGE_KEY = 'utbt:pickBanMotion:v1'

export function isStreamMotionOff(search: string): boolean {
    return new URLSearchParams(search).get('motion') === '0'
}

export function parsePickBanMotion(stored: unknown): boolean {
    return stored !== 'off'
}

export function loadPickBanMotion(): boolean {
    return parsePickBanMotion(getSynced<unknown>(STORAGE_KEY, null))
}

export function savePickBanMotion(animate: boolean): void {
    setSynced(STORAGE_KEY, animate ? 'on' : 'off')
}

export function subscribePickBanMotion(callback: () => void): () => void {
    return subscribeSynced(STORAGE_KEY, callback)
}
