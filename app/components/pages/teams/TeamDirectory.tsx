import { useEffect, useState } from 'react'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { applyToTeam, fetchTeams, type TeamCore } from '@/app/utils/api'
import { ErrorBanner, OpenClosedBadge, SectionCard, TagChip, teamInputClass, teamErrorMessage } from './teamsShared'

const PAGE_SIZE = 10

interface TeamDirectoryProps {
    accessToken: string
    search: string
    openOnly: boolean
    page: number
    onSearchChange: (value: string) => void
    onOpenOnlyChange: (value: boolean) => void
    onPageChange: (page: number) => void
    onApplied: () => void
}

export function TeamDirectory({
    accessToken, search, openOnly, page,
    onSearchChange, onOpenOnlyChange, onPageChange, onApplied,
}: TeamDirectoryProps) {
    const [raw, setRaw] = useState(search)
    const [teams, setTeams] = useState<TeamCore[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [applyingId, setApplyingId] = useState<string | null>(null)
    const [appliedId, setAppliedId] = useState<string | null>(null)

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
            isOpen: openOnly || undefined,
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
    }, [accessToken, search, openOnly, page])

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const apply = async (team: TeamCore) => {
        setApplyingId(team.id)
        setError(null)
        try {
            await applyToTeam(accessToken, team.id)
            setAppliedId(team.id)
            onApplied()
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setApplyingId(null)
        }
    }

    return (
        <SectionCard title="Team Directory" subtitle="Find a team to join. Open teams accept applications directly.">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[12rem]">
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
                <label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-white/10 rounded-md text-sm text-white cursor-pointer hover:border-white/20">
                    <input
                        type="checkbox"
                        checked={openOnly}
                        onChange={e => { onOpenOnlyChange(e.target.checked); onPageChange(1) }}
                        className="accent-[var(--accent-500)] cursor-pointer"
                    />
                    <span>Open only</span>
                </label>
            </div>

            <ErrorBanner message={error} />

            <div className="space-y-2">
                {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading teams…</div>
                ) : teams.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">No teams match your search.</div>
                ) : (
                    teams.map(team => (
                        <div
                            key={team.id}
                            className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-sm font-semibold text-white truncate">{team.name}</span>
                                <TagChip tag={team.tag} />
                                <OpenClosedBadge isOpen={team.is_open} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                            </span>
                            {team.is_open && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={applyingId === team.id || appliedId === team.id}
                                    onClick={() => apply(team)}
                                    className="shrink-0"
                                >
                                    {appliedId === team.id ? 'Applied' : applyingId === team.id ? 'Applying…' : 'Apply'}
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </div>

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
        </SectionCard>
    )
}
