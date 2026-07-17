import { useEffect, useMemo, useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { fetchTeams, type TeamCore, type TeamDetail, type TeamSort } from '@/app/utils/api'
import { ErrorBanner, memberTitle, teamInputClass, teamErrorMessage } from './teamsShared'
import { TeamCard } from './TeamCard'
import { seedOwnerIdentity, useOwnerIdentities } from './ownerAlias'

const PAGE_SIZE = 9

export type TeamAccessFilter = 'all' | 'open' | 'invite'

const ACCESS_OPTIONS: { value: TeamAccessFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'invite', label: 'Invite Only' },
]

const SORT_OPTIONS: { value: TeamSort; label: string }[] = [
    { value: 'added', label: 'Creation date' },
    { value: 'members', label: 'Players' },
]

interface TeamGalleryProps {
    accessToken: string
    myTeam: TeamDetail | null
    appliedTeamIds: string[]
    search: string
    page: number
    access: TeamAccessFilter
    sort: TeamSort
    sortDir: 'asc' | 'desc'
    onSearchChange: (value: string) => void
    onPageChange: (page: number) => void
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
    accessToken, myTeam, appliedTeamIds, search, page, access, sort, sortDir,
    onSearchChange, onPageChange, onAccessChange, onSortChange, onSortDirChange, onSelect,
}: TeamGalleryProps) {
    const appliedSet = useMemo(() => new Set(appliedTeamIds), [appliedTeamIds])
    const [raw, setRaw] = useState(search)
    const [teams, setTeams] = useState<TeamCore[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!myTeam) return
        const ownerMember = myTeam.members.find(m => String(m.user) === String(myTeam.owner))
        seedOwnerIdentity(myTeam.owner, ownerMember?.alias, memberTitle(ownerMember?.title))
    }, [myTeam])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (raw.trim() !== search) {
                onSearchChange(raw.trim())
                onPageChange(1)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [raw, search, onSearchChange, onPageChange])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        fetchTeams(accessToken, {
            search: search || undefined,
            isOpen: accessToIsOpen(access),
            sort,
            order: sortDir,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
        })
            .then(res => {
                if (cancelled) return
                setTeams(res.teams)
                setTotal(res.total)
            })
            .catch(e => { if (!cancelled) setError(teamErrorMessage(e)) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, search, page, access, sort, sortDir])

    const displayTeams = teams

    const ownerIds = useMemo(() => displayTeams.map(t => t.owner), [displayTeams])
    const ownerIdentities = useOwnerIdentities(accessToken, ownerIds)

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
            ) : displayTeams.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">No teams match your search.</div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {displayTeams.map(team => {
                        const owner = ownerIdentities[String(team.owner)]
                        return (
                            <TeamCard
                                key={team.id}
                                team={team}
                                ownerAlias={owner?.alias}
                                ownerTitle={owner?.title}
                                isOwnTeam={team.id === myTeam?.id}
                                applied={appliedSet.has(team.id)}
                                onSelect={onSelect}
                            />
                        )
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="tabular-nums">Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={page <= 1}
                            onClick={() => onPageChange(Math.max(1, page - 1))}
                            className="text-muted-foreground hover:text-foreground px-2"
                        >
                            <ChevronLeft className="size-4" /> Prev
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                            className="text-muted-foreground hover:text-foreground px-2"
                        >
                            Next <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
