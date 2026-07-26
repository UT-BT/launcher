import { fetchUserState, mergeUserState } from '@/app/utils/api'

const SYNCED_KEYS = new Set([
    'utbt:theme:v1',
    'utbt:mapsPageTutorial:v1',
    'utbt:playersPageTutorial:v1',
    'utbt:serversPageTutorial:v1',
    'utbt:serverFavorites:v2',
    'utbt:serverPresets:v1',
    'utbt:mapsPresets:v1',
    'utbt:worldRecordsPresets:v1',
])

export function isSyncedKey(key: string): boolean {
    if (SYNCED_KEYS.has(key)) return true
    if (key.startsWith('utbt:homeMedalHuntHidden:v1:')) return true
    if (key.startsWith('utbt:admin:') && key.endsWith(':filters:v1')) return true
    return false
}

const ACCOUNT_KEY = 'utbt:syncAccount:v1'
const FLUSH_DEBOUNCE_MS = 1500
const MAX_RETRY_DELAY_MS = 60_000
const KEEPALIVE_BODY_LIMIT = 60_000

const memory = new Map<string, unknown>()
const subscribers = new Map<string, Set<() => void>>()
const dirtyKeys = new Set<string>()
let activeToken: string | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushFailures = 0
let lifecycleHooked = false

function readLocal(key: string): unknown {
    if (typeof window === 'undefined') return undefined
    try {
        const raw = window.localStorage.getItem(key)
        return raw === null ? undefined : JSON.parse(raw)
    } catch {
        return undefined
    }
}

function writeLocal(key: string, value: unknown): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        return
    }
}

function notify(key: string): void {
    subscribers.get(key)?.forEach(cb => {
        try { cb() } catch { /* subscriber errors must not break the store */ }
    })
}

export function getSynced<T>(key: string, fallback: T): T {
    if (memory.has(key)) return memory.get(key) as T
    const local = readLocal(key)
    return local === undefined ? fallback : local as T
}

export function setSynced(key: string, value: unknown): void {
    const serialized = JSON.stringify(value)
    if (memory.has(key) && JSON.stringify(memory.get(key)) === serialized) return
    memory.set(key, value)
    writeLocal(key, value)
    notify(key)
    if (activeToken && isSyncedKey(key)) {
        dirtyKeys.add(key)
        scheduleFlush()
    }
}

export function subscribeSynced(key: string, callback: () => void): () => void {
    let set = subscribers.get(key)
    if (!set) {
        set = new Set()
        subscribers.set(key, set)
    }
    set.add(callback)
    return () => { set.delete(callback) }
}

function scheduleFlush(delayMs = FLUSH_DEBOUNCE_MS): void {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => { void flushDirtyKeys() }, delayMs)
}

async function flushDirtyKeys(keepalive = false): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
    }
    const token = activeToken
    if (!token || dirtyKeys.size === 0) return
    const keys = Array.from(dirtyKeys)
    dirtyKeys.clear()
    const blob: Record<string, unknown> = {}
    for (const key of keys) blob[key] = getSynced<unknown>(key, null)
    const useKeepalive = keepalive && JSON.stringify(blob).length <= KEEPALIVE_BODY_LIMIT
    try {
        await mergeUserState(token, blob, useKeepalive)
        flushFailures = 0
    } catch {
        if (activeToken === token) {
            keys.forEach(key => dirtyKeys.add(key))
            flushFailures += 1
            scheduleFlush(Math.min(FLUSH_DEBOUNCE_MS * 2 ** flushFailures, MAX_RETRY_DELAY_MS))
        }
    }
}

function hookLifecycle(): void {
    if (lifecycleHooked || typeof window === 'undefined') return
    lifecycleHooked = true
    const flush = () => { void flushDirtyKeys(true) }
    window.addEventListener('pagehide', flush)
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush()
    })
}

function purgeSyncedState(): void {
    dirtyKeys.clear()
    const keys = new Set<string>()
    if (typeof window !== 'undefined') {
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i)
            if (key && isSyncedKey(key)) keys.add(key)
        }
    }
    for (const key of memory.keys()) {
        if (isSyncedKey(key)) keys.add(key)
    }
    for (const key of keys) {
        memory.delete(key)
        try { window.localStorage.removeItem(key) } catch { /* ignore */ }
        notify(key)
    }
}

export async function initUserStateSync(token: string, accountId: string): Promise<void> {
    if (typeof window !== 'undefined') {
        let previousAccount: string | null = null
        try { previousAccount = window.localStorage.getItem(ACCOUNT_KEY) } catch { /* ignore */ }
        if (previousAccount !== accountId) {
            if (previousAccount !== null) purgeSyncedState()
            try { window.localStorage.setItem(ACCOUNT_KEY, accountId) } catch { /* ignore */ }
        }
    }
    activeToken = token
    hookLifecycle()
    let doc
    try {
        doc = await fetchUserState(token)
    } catch {
        return
    }
    if (activeToken !== token) return

    for (const [key, value] of Object.entries(doc.state)) {
        if (!isSyncedKey(key) || value === null || value === undefined) continue
        if (dirtyKeys.has(key)) continue
        if (JSON.stringify(getSynced<unknown>(key, undefined)) === JSON.stringify(value)) continue
        memory.set(key, value)
        writeLocal(key, value)
        notify(key)
    }

    if (typeof window === 'undefined') return
    const upload: Record<string, unknown> = {}
    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (!key || !isSyncedKey(key) || key in doc.state) continue
        const value = readLocal(key)
        if (value !== undefined) upload[key] = value
    }
    if (Object.keys(upload).length > 0) {
        try {
            await mergeUserState(token, upload)
        } catch { /* offline or older API: local values stay local until the next login */ }
    }
}

export function stopUserStateSync(): void {
    void flushDirtyKeys()
    activeToken = null
}
