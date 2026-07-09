import { useEffect, useState } from 'react'
import { fetchUserSummary } from '@/app/utils/api'

const aliasCache = new Map<string, string>()
const inflight = new Map<string, Promise<void>>()

function resolveOne(accessToken: string, id: string): Promise<void> {
    const existing = inflight.get(id)
    if (existing) return existing
    const p = fetchUserSummary(accessToken, id)
        .then(summary => {
            const alias = summary.profile.alias
            if (alias) aliasCache.set(id, alias)
        })
        .catch(() => undefined)
        .finally(() => { inflight.delete(id) })
    inflight.set(id, p)
    return p
}

export function seedOwnerAlias(id: string | null | undefined, alias: string | null | undefined) {
    if (id && alias) aliasCache.set(String(id), alias)
}

export function useOwnerAliases(accessToken: string | undefined, ownerIds: string[]): Record<string, string> {
    const [aliases, setAliases] = useState<Record<string, string>>({})
    const idsKey = Array.from(new Set(ownerIds.map(String))).sort().join(',')

    useEffect(() => {
        if (!accessToken) return
        const unique = idsKey ? idsKey.split(',') : []
        const snapshot: Record<string, string> = {}
        for (const id of unique) {
            const cached = aliasCache.get(id)
            if (cached) snapshot[id] = cached
        }
        setAliases(snapshot)

        const missing = unique.filter(id => !aliasCache.has(id))
        if (missing.length === 0) return

        let cancelled = false
        void Promise.all(missing.map(id => resolveOne(accessToken, id))).then(() => {
            if (cancelled) return
            setAliases(prev => {
                const next = { ...prev }
                for (const id of missing) {
                    const alias = aliasCache.get(id)
                    if (alias) next[id] = alias
                }
                return next
            })
        })
        return () => { cancelled = true }
    }, [accessToken, idsKey])

    return aliases
}
