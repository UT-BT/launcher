import { useCallback, useEffect, useRef, useState } from 'react'
import {
    addFavoriteServer,
    fetchUserFavoriteServers,
    removeFavoriteServer,
} from '@/app/utils/api'

export interface UseServerFavoritesResult {
    favoriteServerIds: Set<string>
    toggle: (serverId: string) => Promise<void>
}

export function useServerFavorites(
    accessToken: string | undefined,
    userId: string | number | undefined,
): UseServerFavoritesResult {
    const [favoriteServerIds, setFavoriteServerIds] = useState<Set<string>>(() => new Set())
    const favoriteOrderRef = useRef<string[]>([])

    const applyFavorites = useCallback((serverIds: string[]) => {
        favoriteOrderRef.current = serverIds.slice()
        setFavoriteServerIds(new Set(serverIds))
    }, [])

    useEffect(() => {
        let cancelled = false
        if (!accessToken || !userId) {
            applyFavorites([])
            return
        }
        ;(async () => {
            try {
                const serverIds = await fetchUserFavoriteServers(accessToken, userId)
                if (cancelled) return
                applyFavorites(serverIds)
            } catch (err) {
                console.error('Failed to load server favorites', err)
            }
        })()
        return () => { cancelled = true }
    }, [accessToken, userId, applyFavorites])

    const toggle = useCallback(async (serverId: string) => {
        if (!accessToken) return
        const wasFavorited = favoriteOrderRef.current.includes(serverId)
        const previousOrder = favoriteOrderRef.current.slice()
        const nextOrder = wasFavorited
            ? favoriteOrderRef.current.filter((id) => id !== serverId)
            : [...favoriteOrderRef.current, serverId]
        applyFavorites(nextOrder)

        try {
            if (wasFavorited) {
                await removeFavoriteServer(accessToken, serverId)
            } else {
                await addFavoriteServer(accessToken, serverId)
            }
        } catch (err) {
            console.error('Server favorite toggle failed; rolling back', err)
            applyFavorites(previousOrder)
        }
    }, [accessToken, applyFavorites])

    return { favoriteServerIds, toggle }
}
