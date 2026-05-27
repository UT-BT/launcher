import { useCallback, useEffect, useRef, useState } from 'react'
import {
    addFavoriteMap,
    fetchUserFavorites,
    removeFavoriteMap,
    replaceFavoriteMaps,
} from '@/app/utils/api'

/**
 * Single source of truth for map favorites in the launcher.
 *
 * Contract — any code that mutates favorites MUST go through `toggle` /
 * `replace` returned here (or via props that thread down to them). Calling
 * `addFavoriteMap` / `removeFavoriteMap` directly will desynchronise the local
 * state, UTBT_MapVote.ini, and the backend.
 *
 * Sync model:
 *   toggle/replace → backend write → ini write (best-effort)
 *   game-close event → ini → backend replace (so out-of-launcher edits land)
 *   startup → compare db/ini and surface SyncModal on divergence
 */

export interface SyncDiff {
    open: boolean
    db: string[]
    ini: string[]
}

export interface UseFavoritesResult {
    favoriteMapNames: Set<string>
    toggle: (mapName: string) => Promise<void>
    replace: (mapNames: string[]) => Promise<void>
    syncModal: SyncDiff
    resolveSync: (resolution: 'db-wins' | 'ini-wins' | 'merge') => Promise<void>
    dismissSync: () => void
}

export function useFavorites(
    accessToken: string | undefined,
    userId: string | number | undefined,
): UseFavoritesResult {
    const [favoriteMapNames, setFavoriteMapNames] = useState<Set<string>>(() => new Set())
    const favoriteOrderRef = useRef<string[]>([])
    const startupSyncCheckedRef = useRef(false)
    const [syncModal, setSyncModal] = useState<SyncDiff>({ open: false, db: [], ini: [] })

    const writeIniBestEffort = useCallback(async (mapNames: string[]) => {
        try {
            await window.conveyor.favorites.writeIni(mapNames)
        } catch (err) {
            console.warn('writeIni failed (ignored)', err)
        }
    }, [])

    const applyFavorites = useCallback((names: string[]) => {
        favoriteOrderRef.current = names.slice()
        setFavoriteMapNames(new Set(names))
    }, [])

    // Initial load + startup sync diff check
    useEffect(() => {
        let cancelled = false
        if (!accessToken || !userId) {
            favoriteOrderRef.current = []
            setFavoriteMapNames(new Set())
            startupSyncCheckedRef.current = false
            return
        }
        ;(async () => {
            try {
                const dbNames = await fetchUserFavorites(accessToken, userId)
                if (cancelled) return
                applyFavorites(dbNames)

                if (startupSyncCheckedRef.current) return
                const ini = await window.conveyor.favorites.readIni()
                if (cancelled) return
                if (!ini.ok) {
                    startupSyncCheckedRef.current = true
                    return
                }
                startupSyncCheckedRef.current = true

                const dbSet = new Set(dbNames)
                const iniSet = new Set(ini.mapNames)
                const sameSize = dbSet.size === iniSet.size
                const sameContents = sameSize && [...dbSet].every((n) => iniSet.has(n))
                if (sameContents) return

                setSyncModal({ open: true, db: dbNames, ini: ini.mapNames })
            } catch (err) {
                console.error('Failed to load / sync favorites', err)
            }
        })()
        return () => { cancelled = true }
    }, [accessToken, userId, applyFavorites])

    const toggle = useCallback(async (mapName: string) => {
        if (!accessToken) return
        const wasFavorited = favoriteOrderRef.current.includes(mapName)
        const nextOrder = wasFavorited
            ? favoriteOrderRef.current.filter((n) => n !== mapName)
            : [...favoriteOrderRef.current, mapName]
        applyFavorites(nextOrder)

        try {
            if (wasFavorited) {
                await removeFavoriteMap(accessToken, mapName)
            } else {
                await addFavoriteMap(accessToken, mapName)
            }
            await writeIniBestEffort(nextOrder)
        } catch (err) {
            console.error('Favorite toggle failed; rolling back', err)
            applyFavorites(
                wasFavorited
                    ? [...favoriteOrderRef.current, mapName]
                    : favoriteOrderRef.current.filter((n) => n !== mapName),
            )
        }
    }, [accessToken, applyFavorites, writeIniBestEffort])

    const replace = useCallback(async (mapNames: string[]) => {
        if (!accessToken) return
        const prev = favoriteOrderRef.current.slice()
        applyFavorites(mapNames)
        try {
            const updated = await replaceFavoriteMaps(accessToken, mapNames)
            applyFavorites(updated)
            await writeIniBestEffort(updated)
        } catch (err) {
            console.error('Favorite replace failed; rolling back', err)
            applyFavorites(prev)
        }
    }, [accessToken, applyFavorites, writeIniBestEffort])

    // Game-close: read ini → replace DB
    useEffect(() => {
        if (!accessToken) return
        const remove = window.utFavorites?.onGameClosed(async () => {
            try {
                const ini = await window.conveyor.favorites.readIni()
                if (!ini.ok) return
                const updated = await replaceFavoriteMaps(accessToken, ini.mapNames)
                applyFavorites(updated)
            } catch (err) {
                console.error('Failed to sync favorites from ini after game close', err)
            }
        })
        return () => { remove?.() }
    }, [accessToken, applyFavorites])

    const resolveSync = useCallback(async (resolution: 'db-wins' | 'ini-wins' | 'merge') => {
        if (!accessToken) return
        const { db, ini } = syncModal
        let result: string[] = []
        try {
            if (resolution === 'db-wins') {
                await writeIniBestEffort(db)
                result = db
            } else if (resolution === 'ini-wins') {
                const updated = await replaceFavoriteMaps(accessToken, ini)
                result = updated
                await writeIniBestEffort(updated)
            } else {
                const merged: string[] = [...db]
                const seen = new Set(db)
                for (const name of ini) {
                    if (!seen.has(name)) {
                        seen.add(name)
                        merged.push(name)
                    }
                }
                const updated = await replaceFavoriteMaps(accessToken, merged)
                result = updated
                await writeIniBestEffort(updated)
            }
            applyFavorites(result)
        } catch (err) {
            console.error('Sync resolution failed', err)
        } finally {
            setSyncModal({ open: false, db: [], ini: [] })
        }
    }, [accessToken, syncModal, applyFavorites, writeIniBestEffort])

    const dismissSync = useCallback(() => {
        setSyncModal({ open: false, db: [], ini: [] })
    }, [])

    return {
        favoriteMapNames,
        toggle,
        replace,
        syncModal,
        resolveSync,
        dismissSync,
    }
}
