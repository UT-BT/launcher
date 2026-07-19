import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { fetchPlayers, type PlayerListRow } from '@/app/utils/api'
import { teamInputClass, teamErrorMessage } from './teamsShared'

interface PlayerSearchInputProps {
    accessToken: string
    onPick: (player: PlayerListRow) => void
    excludeIds?: Set<string>
    disabled?: boolean
    placeholder?: string
}

export function PlayerSearchInput({
    accessToken, onPick, excludeIds, disabled, placeholder = 'Search players by alias…',
}: PlayerSearchInputProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PlayerListRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const term = query.trim()
        if (term.length < 2) {
            setResults([])
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        setError(null)
        const timer = setTimeout(() => {
            fetchPlayers(accessToken, { search: term, limit: 8, sort: 'alias', order: 'asc' })
                .then(rows => { if (!cancelled) setResults(rows) })
                .catch(e => { if (!cancelled) setError(teamErrorMessage(e)) })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 300)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [query, accessToken])

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [])

    const pick = (player: PlayerListRow) => {
        onPick(player)
        setQuery('')
        setResults([])
        setOpen(false)
    }

    const visible = results.filter(r => !excludeIds?.has(String(r.id)))

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                    value={query}
                    disabled={disabled}
                    onFocus={() => setOpen(true)}
                    onChange={e => { setQuery(e.target.value); setOpen(true) }}
                    placeholder={placeholder}
                    className={cn(teamInputClass, 'w-full pl-9 pr-8 disabled:opacity-50')}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); setResults([]) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white cursor-pointer"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

            {open && query.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-popover border border-white/10 rounded-lg shadow-2xl p-1">
                    {loading ? (
                        <div className="px-3 py-3 text-sm text-muted-foreground">Searching…</div>
                    ) : error ? (
                        <div className="px-3 py-3 text-sm text-red-300">{error}</div>
                    ) : visible.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-muted-foreground">No players found.</div>
                    ) : (
                        visible.map(player => (
                            <button
                                key={player.id}
                                type="button"
                                onClick={() => pick(player)}
                                className="w-full flex items-center px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer text-left"
                            >
                                <PlayerInfo
                                    userId={player.id}
                                    alias={player.alias}
                                    title={player.active_title}
                                    size="sm"
                                    interactive={false}
                                />
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
