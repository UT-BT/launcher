import { useEffect, useState } from 'react'
import { fetchUserSummary, type ActiveTitle } from '@/app/utils/api'

export interface OwnerIdentity {
    alias?: string
    title?: ActiveTitle | null
}

const cache = new Map<string, OwnerIdentity>()
const inflight = new Map<string, Promise<void>>()

function resolveOne(accessToken: string, id: string): Promise<void> {
    const existing = inflight.get(id)
    if (existing) return existing
    const p = fetchUserSummary(accessToken, id)
        .then(summary => {
            cache.set(id, { alias: summary.profile.alias ?? undefined, title: summary.profile.active_title ?? null })
        })
        .catch(() => undefined)
        .finally(() => { inflight.delete(id) })
    inflight.set(id, p)
    return p
}

export function seedOwnerIdentity(
    id: string | null | undefined,
    alias: string | null | undefined,
    title: ActiveTitle | null | undefined,
) {
    if (!id) return
    const existing = cache.get(String(id)) ?? {}
    cache.set(String(id), {
        alias: alias ?? existing.alias,
        title: title !== undefined ? title : existing.title,
    })
}

export function useOwnerIdentities(accessToken: string | undefined, ownerIds: string[]): Record<string, OwnerIdentity> {
    const [identities, setIdentities] = useState<Record<string, OwnerIdentity>>({})
    const idsKey = Array.from(new Set(ownerIds.map(String))).sort().join(',')

    useEffect(() => {

        const unique = idsKey ? idsKey.split(',') : []
        const snapshot: Record<string, OwnerIdentity> = {}
        for (const id of unique) {
            const cached = cache.get(id)
            if (cached) snapshot[id] = cached
        }
        setIdentities(snapshot)

        const missing = unique.filter(id => !cache.has(id))
        if (missing.length === 0) return

        let cancelled = false
        void Promise.all(missing.map(id => resolveOne(accessToken ?? '', id))).then(() => {
            if (cancelled) return
            setIdentities(prev => {
                const next = { ...prev }
                for (const id of missing) {
                    const info = cache.get(id)
                    if (info) next[id] = info
                }
                return next
            })
        })
        return () => { cancelled = true }
    }, [accessToken, idsKey])

    return identities
}
