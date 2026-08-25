import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchMapsFuzzy } from '@/app/utils/api'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'

interface MapSearchInputProps {
    accessToken: string
    value: string | null
    onChange: (mapName: string | null) => void
    disabled?: boolean
    placeholder?: string
    className?: string
}

export function MapSearchInput({
    accessToken, value, onChange, disabled, placeholder = 'Search maps…', className,
}: MapSearchInputProps) {
    const [query, setQuery] = useState(value ?? '')
    const [results, setResults] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setQuery(value ?? '') }, [value])

    useEffect(() => {
        const term = query.trim()
        if (!open || term.length < 2 || term === value) {
            setResults([])
            return
        }

        const controller = new AbortController()
        setLoading(true)

        const timer = setTimeout(() => {
            fetchMapsFuzzy(accessToken, term, 8, controller.signal)
                .then(rows => setResults(rows.map(row => row.name)))
                .catch(() => setResults([]))
                .finally(() => setLoading(false))
        }, 250)

        return () => { controller.abort(); clearTimeout(timer); setLoading(false) }
    }, [query, open, value, accessToken])

    useEffect(() => {
        const onDocClick = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [])

    const commit = () => {
        const term = query.trim()
        if (!term) onChange(null)
        else if (term !== value) setQuery(value ?? '')
    }

    const pick = (mapName: string) => {
        onChange(mapName)
        setQuery(mapName)
        setResults([])
        setOpen(false)
    }

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                    value={query}
                    disabled={disabled}
                    onFocus={() => setOpen(true)}
                    onChange={event => { setQuery(event.target.value); setOpen(true) }}
                    onBlur={event => {
                        if (containerRef.current?.contains(event.relatedTarget as Node | null)) return
                        commit()
                    }}
                    placeholder={placeholder}
                    className={cn(teamInputClass, 'w-full h-8 py-1 pl-8 pr-7 text-xs disabled:opacity-50')}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); setResults([]); onChange(null) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white cursor-pointer"
                    >
                        <X className="size-3" />
                    </button>
                )}
            </div>

            {open && query.trim().length >= 2 && query.trim() !== value && (
                <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto bg-popover border border-white/10 rounded-lg shadow-2xl p-1">
                    {loading ? (
                        <div className="px-2 py-2 text-xs text-muted-foreground">Searching…</div>
                    ) : results.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-muted-foreground">No maps found.</div>
                    ) : results.map(name => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => pick(name)}
                            className="w-full px-2 py-1.5 rounded-md text-left text-xs text-foreground hover:bg-white/5 transition-colors cursor-pointer truncate"
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
