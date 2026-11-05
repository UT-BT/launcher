import { SEASONAL_THEME_ID } from '../../../seasonal/appearance'

export const SEASONAL_NOTICE_STORAGE_KEY = 'utbt:seasonalNotice:v1'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>
type StorageGetter = () => KeyValueStorage

const localStorageGetter: StorageGetter = () => window.localStorage
const listeners = new Set<() => void>()

type ThemeMarkers = readonly { id: string; new?: boolean }[]

export function seasonalNoticeAnnounced(themes: ThemeMarkers): boolean {
    return themes.some(theme => theme.id === SEASONAL_THEME_ID && theme.new)
}

export function seasonalNoticeVisible({ themes, themeId, dismissed }: { themes: ThemeMarkers; themeId: string; dismissed: boolean }): boolean {
    return seasonalNoticeAnnounced(themes) && themeId !== SEASONAL_THEME_ID && !dismissed
}

export function isSeasonalNoticeDismissed(storage: StorageGetter = localStorageGetter): boolean {
    try {
        const raw = storage().getItem(SEASONAL_NOTICE_STORAGE_KEY)
        return raw !== null && typeof JSON.parse(raw) === 'string'
    } catch {
        return false
    }
}

export function dismissSeasonalNotice(now = new Date(), storage: StorageGetter = localStorageGetter) {
    try {
        storage().setItem(SEASONAL_NOTICE_STORAGE_KEY, JSON.stringify(now.toISOString()))
    } catch {
        return
    } finally {
        for (const listener of listeners) listener()
    }
}

export function subscribeSeasonalNotice(listener: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
        if (event.key === SEASONAL_NOTICE_STORAGE_KEY || event.key === null) listener()
    }
    listeners.add(listener)
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
        listeners.delete(listener)
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
}
