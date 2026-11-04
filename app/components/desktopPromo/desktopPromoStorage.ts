export const DESKTOP_SEEN_STORAGE_KEY = 'utbt:desktopSeen:v1'
export const DESKTOP_PROMO_DISMISSED_STORAGE_KEY = 'utbt:desktopPromoDismissed:v1'

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>
type StorageGetter = () => KeyValueStorage

const localStorageGetter: StorageGetter = () => window.localStorage

function readJson(key: string, storage: StorageGetter): unknown {
  try {
    const raw = storage().getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown, storage: StorageGetter) {
  try {
    storage().setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

export function readStoredDesktopSeen(storage: StorageGetter = localStorageGetter): string | null | undefined {
  const value = readJson(DESKTOP_SEEN_STORAGE_KEY, storage)
  return typeof value === 'string' || value === null ? value : undefined
}

export function writeStoredDesktopSeen(value: string | null, storage: StorageGetter = localStorageGetter) {
  writeJson(DESKTOP_SEEN_STORAGE_KEY, value, storage)
}

export function readStoredDismissedAt(storage: StorageGetter = localStorageGetter): string | undefined {
  const value = readJson(DESKTOP_PROMO_DISMISSED_STORAGE_KEY, storage)
  return typeof value === 'string' ? value : undefined
}

export function writeStoredDismissedAt(iso: string, storage: StorageGetter = localStorageGetter) {
  writeJson(DESKTOP_PROMO_DISMISSED_STORAGE_KEY, iso, storage)
}
