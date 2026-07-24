import { useEffect, useReducer } from 'react'
import { ChevronRight, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatAddedDate } from '@/app/utils/format'
import { fetchMap, fetchMapCapsCount, type MapMetadata } from '@/app/utils/api'

interface MapVersionsBarProps {
    map: MapMetadata | null
    accessToken?: string
    onSelect?: (mapName: string) => void
}

type CacheEntry = { name: string; added?: string }
type ChainEntry = CacheEntry & { isCurrent: boolean }

const CHAIN_COLUMNS = ['name', 'added', 'preceded_by', 'superseded_by']

// Module-level caches survive component remounts as the user navigates between
// versions in the same chain. The chain is identical for every member, so we
// key the same array under each member's name.
const chainCache = new Map<string, CacheEntry[]>()
const capsHasCache = new Map<string, boolean>()

function deriveVersionLabels(names: string[]): string[] {
    if (names.length <= 1) return names.map(() => 'v1')
    let prefix = names[0]
    for (const n of names.slice(1)) {
        let i = 0
        while (i < prefix.length && i < n.length && prefix[i].toLowerCase() === n[i].toLowerCase()) i++
        prefix = prefix.slice(0, i)
    }
    prefix = prefix.replace(/[-_ ]*v\d*$/i, '')
    return names.map((n, idx) => {
        const suffix = n.slice(prefix.length).replace(/^[-_ ]+/, '')
        if (!suffix) return idx === 0 ? 'v1' : `v${idx + 1}`
        const m = suffix.match(/^v(.+)$/i)
        const token = m ? m[1] : suffix
        return `v${token}`
    })
}

export function MapVersionsBar({ map, accessToken, onSelect }: MapVersionsBarProps) {
    const [, forceRender] = useReducer((x: number) => x + 1, 0)

    const currentName = map?.name ?? null
    const hasPredecessor = !!map?.preceded_by
    const hasSuccessor = !!map?.superseded_by

    const cached = currentName ? chainCache.get(currentName) : null
    const chain: ChainEntry[] | null = cached
        ? cached.map(e => ({ ...e, isCurrent: e.name === currentName }))
        : null

    useEffect(() => {
        if (!currentName || (!hasPredecessor && !hasSuccessor)) return
        let cancelled = false

        ;(async () => {
            if (!chainCache.has(currentName)) {
                const visited = new Set<string>([currentName])
                const built: CacheEntry[] = [{ name: currentName, added: map?.added }]

                let cursor: string | null | undefined = map?.preceded_by
                while (cursor && !visited.has(cursor)) {
                    visited.add(cursor)
                    const match = await fetchMap(accessToken ?? '', cursor, CHAIN_COLUMNS)
                    if (!match) break
                    built.unshift({ name: match.name, added: match.added })
                    cursor = match.preceded_by
                }

                cursor = map?.superseded_by
                while (cursor && !visited.has(cursor)) {
                    visited.add(cursor)
                    const match = await fetchMap(accessToken ?? '', cursor, CHAIN_COLUMNS)
                    if (!match) break
                    built.push({ name: match.name, added: match.added })
                    cursor = match.superseded_by
                }

                if (cancelled) return
                for (const e of built) chainCache.set(e.name, built)
                forceRender()
            }

            const entries = chainCache.get(currentName)!
            const missing = entries.filter(e => e.name !== currentName && !capsHasCache.has(e.name))
            if (missing.length === 0) return

            const results = await Promise.all(
                missing.map(async e => [e.name, (await fetchMapCapsCount(accessToken ?? '', e.name)) > 0] as const),
            )
            if (cancelled) return
            for (const [n, v] of results) capsHasCache.set(n, v)
            forceRender()
        })()

        return () => { cancelled = true }
    }, [accessToken, currentName, hasPredecessor, hasSuccessor, map?.preceded_by, map?.superseded_by, map?.added])

    if (!map || (!hasPredecessor && !hasSuccessor)) return null
    if (!chain || chain.length < 2) return null

    const labels = deriveVersionLabels(chain.map(e => e.name))

    return (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-hairline/[0.03] border border-hairline/5">
            <GitBranch className="size-3 text-muted-foreground/70 shrink-0" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-0.5">
                Versions
            </span>
            {chain.map((entry, idx) => {
                const label = labels[idx]
                const dateText = entry.added ? formatAddedDate(entry.added) : '—'
                const clickable = !entry.isCurrent && capsHasCache.get(entry.name) === true && !!onSelect
                const tip = (
                    <div className="flex flex-col gap-0.5 leading-tight">
                        <span className="font-semibold">{entry.name}</span>
                        <span className="text-[10px] text-muted-foreground">Added {dateText}</span>
                        {clickable && (
                            <span className="text-[10px] text-amber-300">Records were not transferred</span>
                        )}
                    </div>
                )
                const pillClass = cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold',
                    entry.isCurrent
                        ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                        : clickable
                            ? 'bg-hairline/[0.04] text-foreground/70 border border-hairline/10 hover:bg-hairline/10 hover:text-foreground cursor-pointer transition-colors'
                            : 'bg-hairline/[0.04] text-foreground/60 border border-hairline/10',
                )
                const pill = clickable ? (
                    <button
                        type="button"
                        onClick={() => onSelect?.(entry.name)}
                        className={pillClass}
                    >
                        {label}
                    </button>
                ) : (
                    <span className={pillClass}>{label}</span>
                )
                return (
                    <span key={entry.name} className="inline-flex items-center gap-1">
                        {idx > 0 && <ChevronRight className="size-3 text-muted-foreground/40" />}
                        <Tooltip content={tip} side="top">{pill}</Tooltip>
                    </span>
                )
            })}
        </div>
    )
}
