import { useEffect, useState } from 'react'
import { ArrowRight, AlertTriangle, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import { fetchMaps, type MapMetadata } from '@/app/utils/api'

interface MapVersionsCardProps {
    map: MapMetadata | null
    accessToken?: string
    onSelect: (mapName: string) => void
}

type ChainEntry = { name: string; added?: string; difficulty?: number; isCurrent: boolean }

const CHAIN_COLUMNS = ['name', 'added', 'difficulty', 'preceded_by', 'superseded_by']

export function MapVersionsCard({ map, accessToken, onSelect }: MapVersionsCardProps) {
    const [chain, setChain] = useState<ChainEntry[] | null>(null)
    const [loading, setLoading] = useState(false)

    const currentName = map?.name ?? null
    const hasPredecessor = !!map?.preceded_by
    const hasSuccessor = !!map?.superseded_by

    useEffect(() => {
        if (!accessToken || !currentName || (!hasPredecessor && !hasSuccessor)) {
            setChain(null)
            return
        }
        let cancelled = false
        setLoading(true)

        ;(async () => {
            const visited = new Set<string>([currentName])
            const built: ChainEntry[] = [{
                name: currentName,
                added: map?.added,
                difficulty: map?.difficulty,
                isCurrent: true,
            }]

            // Walk backwards through `preceded_by`.
            let cursor: string | null | undefined = map?.preceded_by
            while (cursor && !visited.has(cursor)) {
                visited.add(cursor)
                const fetched = await fetchMaps(accessToken, {
                    name: cursor,
                    columns: CHAIN_COLUMNS,
                    active: undefined,
                })
                const match = fetched.find(m => m.name === cursor) ?? fetched[0]
                if (!match) break
                built.unshift({
                    name: match.name,
                    added: match.added,
                    difficulty: match.difficulty,
                    isCurrent: false,
                })
                cursor = (match as MapMetadata).preceded_by
            }

            // Walk forwards through `superseded_by`.
            cursor = map?.superseded_by
            while (cursor && !visited.has(cursor)) {
                visited.add(cursor)
                const fetched = await fetchMaps(accessToken, {
                    name: cursor,
                    columns: CHAIN_COLUMNS,
                    active: undefined,
                })
                const match = fetched.find(m => m.name === cursor) ?? fetched[0]
                if (!match) break
                built.push({
                    name: match.name,
                    added: match.added,
                    difficulty: match.difficulty,
                    isCurrent: false,
                })
                cursor = (match as MapMetadata).superseded_by
            }

            if (cancelled) return
            setChain(built)
            setLoading(false)
        })()

        return () => { cancelled = true }
    }, [accessToken, currentName, hasPredecessor, hasSuccessor, map?.preceded_by, map?.superseded_by, map?.added, map?.difficulty])

    if (!map || (!hasPredecessor && !hasSuccessor)) return null

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Map Versions
                </div>
            </div>

            {hasSuccessor && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="size-3.5 text-amber-300 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200 leading-snug">
                        A newer version of this map is available.
                    </div>
                </div>
            )}

            {loading && !chain && (
                <div className="space-y-1.5">
                    <div className="h-7 w-full bg-white/5 rounded animate-pulse" />
                    <div className="h-7 w-full bg-white/5 rounded animate-pulse" />
                </div>
            )}

            {chain && chain.length > 0 && (
                <div className="space-y-1">
                    {chain.map((entry, idx) => {
                        const year = entry.added ? new Date(entry.added).getFullYear() : null
                        return (
                            <div key={entry.name}>
                                <button
                                    type="button"
                                    onClick={() => { if (!entry.isCurrent) onSelect(entry.name) }}
                                    disabled={entry.isCurrent}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-left transition-colors',
                                        entry.isCurrent
                                            ? 'bg-emerald-500/10 border-emerald-500/30 cursor-default'
                                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20 cursor-pointer',
                                    )}
                                >
                                    <span className={cn(
                                        'text-xs font-semibold truncate min-w-0',
                                        entry.isCurrent ? 'text-emerald-200' : 'text-white/80',
                                    )}>
                                        {displayMapName(entry.name)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                        {entry.isCurrent ? 'current' : (year ?? '')}
                                    </span>
                                </button>
                                {idx < chain.length - 1 && (
                                    <div className="flex justify-center py-0.5">
                                        <ArrowRight className="size-3 text-muted-foreground/40 rotate-90" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
