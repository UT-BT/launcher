import { useEffect, useSyncExternalStore } from 'react'
import { fetchGatewayPatrons } from '@/app/platform/gateway'

/**
 * Patreon member tiers, keyed by Discord user id (the same id used as
 * `PlayerInfo.userId` / in avatar URLs). Source: gateway `GET /patreon`,
 * fetched once via IPC and cached in localStorage — members rarely change, so
 * we don't refetch per render. See agents/data-sources.md.
 */

const STORAGE_KEY = 'utbt:patreon:v1'
const TTL_MS = 1 * 60 * 60 * 1000 // 1h

export type PatreonTier = 1 | 2 | 3
type TierMap = Record<string, PatreonTier>

interface PatreonPayload {
    tier1?: string[]
    tier2?: string[]
    tier3?: string[]
}

interface PersistShape {
    tiers: TierMap
    fetchedAtIso: string
}

let tiers: TierMap = {}
let loaded = false
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

function flatten(payload: PatreonPayload | null | undefined): TierMap {
    const map: TierMap = {}
    for (const id of payload?.tier1 ?? []) map[id] = 1
    for (const id of payload?.tier2 ?? []) map[id] = 2
    for (const id of payload?.tier3 ?? []) map[id] = 3
    return map
}

function readCache(): PersistShape | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as PersistShape
        if (!parsed || typeof parsed !== 'object' || !parsed.tiers || !parsed.fetchedAtIso) return null
        return parsed
    } catch {
        return null
    }
}

function isFresh(iso: string): boolean {
    const t = Date.parse(iso)
    return Number.isFinite(t) && Date.now() - t < TTL_MS
}

export function loadPatreonMembers(): Promise<void> {
    if (loaded) return Promise.resolve()
    if (inFlight) return inFlight

    inFlight = (async () => {
        const cached = readCache()
        if (cached && isFresh(cached.fetchedAtIso)) {
            tiers = cached.tiers
            loaded = true
            emit()
            return
        }

        try {
            const payload = await fetchGatewayPatrons<PatreonPayload>()
            tiers = flatten(payload)
            loaded = true
            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({ tiers, fetchedAtIso: new Date().toISOString() } satisfies PersistShape),
                )
            } catch {
                // localStorage may be full or unavailable; swallow.
            }
            emit()
        } catch (err) {
            console.error('Failed to load Patreon members', err)
            // Fall back to a stale cache if present so patrons still show.
            if (cached) {
                tiers = cached.tiers
                loaded = true
                emit()
            }
        }
    })().finally(() => {
        inFlight = null
    })

    return inFlight
}

/**
 * Returns the Patreon tier for a player (0 if none / no userId). Triggers a
 * one-time lazy load if the list hasn't been fetched yet.
 */
export function usePatreonTier(userId?: string | number): 0 | PatreonTier {
    const getSnapshot = () => (userId == null ? 0 : tiers[String(userId)] ?? 0)
    const tier = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    useEffect(() => {
        void loadPatreonMembers()
    }, [])

    return tier
}
