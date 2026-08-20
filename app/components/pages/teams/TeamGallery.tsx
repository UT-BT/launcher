import { useEffect, useState } from 'react'
import { Search, X, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { fetchTeams, type TeamCore, type TeamDetail, type TeamSort } from '@/app/utils/api'
import { ErrorBanner, teamInputClass, teamErrorMessage } from './teamsShared'
import { TeamCard } from './TeamCard'
import { isTeamStatSort } from './teamStats'

export type TeamAccessFilter = 'all' | 'open' | 'invite'

const ACCESS_OPTIONS: { value: TeamAccessFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'invite', label: 'Invite Only' },
]

const SORT_OPTIONS: { value: TeamSort; label: string }[] = [
    { value: 'added', label: 'Creation date' },
    { value: 'name', label: 'Name' },
    { value: 'members', label: 'Players' },
    { value: 'world_records', label: 'World Records' },
    { value: 'caps', label: 'Total Caps' },
    { value: 'playtime', label: 'Time Played' },
]

interface TeamGalleryProps {
    accessToken: string
    myTeam: TeamDetail | null
    search: string
    access: TeamAccessFilter
    sort: TeamSort
    sortDir: 'asc' | 'desc'
    onSearchChange: (value: string) => void
    onAccessChange: (value: TeamAccessFilter) => void
    onSortChange: (value: TeamSort) => void
    onSortDirChange: (value: 'asc' | 'desc') => void
    onSelect: (teamId: string) => void
}

function accessToIsOpen(access: TeamAccessFilter): boolean | undefined {
    if (access === 'open') return true
    if (access === 'invite') return false
    return undefined
}

export function TeamGallery({
    accessToken, myTeam, search, access, sort, sortDir,
    onSearchChange, onAccessChange, onSortChange, onSortDirChange, onSelect,
}: TeamGalleryProps) {
    const [raw, setRaw] = useState(search)
    const [teams, setTeams] = useState<TeamCore[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            if (raw.trim() !== search) onSearchChange(raw.trim())
        }, 350)
        return () => clearTimeout(timer)
    }, [raw, search, onSearchChange])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        fetchTeams(accessToken, {
            search: search || undefined,
            isOpen: accessToIsOpen(access),
            sort,
            order: sortDir,
            limit: 0,
        })
            .then(res => { if (!cancelled) setTeams(res.teams) })
            .catch(e => { if (!cancelled) setError(teamErrorMessage(e)) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, search, access, sort, sortDir])

    const highlight = isTeamStatSort(sort) ? sort : undefined

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                    value={raw}
                    onChange={e => setRaw(e.target.value)}
                    placeholder="Search teams…"
                    className={cn(teamInputClass, 'w-full pl-9 pr-8')}
                />
                {raw && (
                    <button
                        type="button"
                        onClick={() => setRaw('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white cursor-pointer"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                    {ACCESS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onAccessChange(opt.value)}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                access === opt.value
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sort</span>
                    <select
                        value={sort}
                        onChange={e => onSortChange(e.target.value as TeamSort)}
                        style={{ colorScheme: 'dark' }}
                        className={cn(teamInputClass, 'py-1.5 cursor-pointer')}
                    >
                        {SORT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
                        className="px-2"
                        title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                    >
                        {sortDir === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                    </Button>
                </div>
            </div>

            <ErrorBanner message={error} />

            {loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Loading teams…</div>
            ) : teams.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">No teams match your search.</div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {teams.map(team => (
                            <TeamCard
                                key={team.id}
                                team={team}
                                isOwnTeam={team.id === myTeam?.id}
                                highlight={highlight}
                                onSelect={onSelect}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                    </p>
                </>
            )}
        </div>
    )
}
