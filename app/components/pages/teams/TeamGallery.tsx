import { useEffect, useMemo, useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { fetchTeams, type TeamCore, type TeamDetail } from '@/app/utils/api'
import { ErrorBanner, teamInputClass, teamErrorMessage } from './teamsShared'
import { TeamCard } from './TeamCard'
import { seedOwnerAlias, useOwnerAliases } from './ownerAlias'

const PAGE_SIZE = 9

interface TeamGalleryProps {
    accessToken: string
    myTeam: TeamDetail | null
    search: string
    page: number
    onSearchChange: (value: string) => void
    onPageChange: (page: number) => void
    onSelect: (teamId: string) => void
}

function toCore(team: TeamDetail): TeamCore {
    return {
        id: team.id,
        name: team.name,
        tag: team.tag,
        tag_position: team.tag_position,
        is_open: team.is_open,
        owner: team.owner,
        member_count: team.member_count,
        added: team.added,
    }
}

function matchesSearch(team: TeamCore, search: string): boolean {
    if (!search) return true
    const q = search.toLowerCase()
    return team.name.toLowerCase().includes(q) || (team.tag?.toLowerCase().includes(q) ?? false)
}

export function TeamGallery({
    accessToken, myTeam, search, page, onSearchChange, onPageChange, onSelect,
}: TeamGalleryProps) {
    const [raw, setRaw] = useState(search)
    const [teams, setTeams] = useState<TeamCore[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!myTeam) return
        const ownerMember = myTeam.members.find(m => String(m.user) === String(myTeam.owner))
        seedOwnerAlias(myTeam.owner, ownerMember?.alias)
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
    }, [accessToken, search, page])

    const displayTeams = useMemo(() => {
        const pinnedOwn = page === 1 && myTeam && matchesSearch(toCore(myTeam), search) ? toCore(myTeam) : null
        const listed = teams.filter(t => t.id !== myTeam?.id)
        return pinnedOwn ? [pinnedOwn, ...listed] : listed
    }, [page, myTeam, search, teams])

    const ownerIds = useMemo(() => displayTeams.map(t => t.owner), [displayTeams])
    const ownerAliases = useOwnerAliases(accessToken, ownerIds)

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

            <ErrorBanner message={error} />

            {loading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Loading teams…</div>
            ) : displayTeams.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">No teams match your search.</div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {displayTeams.map(team => (
                        <TeamCard
                            key={team.id}
                            team={team}
                            ownerAlias={ownerAliases[String(team.owner)]}
                            isOwnTeam={team.id === myTeam?.id}
                            onSelect={onSelect}
                        />
                    ))}
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
