import { useCallback, useEffect, useState } from 'react'
import { Check, Clock, Globe, Pencil, Trash2, UserMinus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { useNavState } from '@/app/components/navigation/useNavState'
import { AdminSelect } from '@/app/components/pages/admin/components/controls'
import { ErrorBanner, SectionCard, teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { formatEventDateTime } from '../eventsShared'
import {
    deleteEventAdminTeam, fetchEventAuditLog, fetchEventVolunteers,
    kickEventTeamMember, removeEventLfp, updateEventAdminTeam, eventErrorMessage,
    type EventAuditEntry, type EventDetail, type EventLfpEntry, type EventTeam,
    type EventTeamMember, type EventTeamStatus, type EventVolunteerRow,
} from '@/app/utils/api'

const TEAM_STATUS_STYLES: Record<EventTeamStatus, string> = {
    pending: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    registered: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    withdrawn: 'bg-white/5 border-white/20 text-muted-foreground',
    disqualified: 'bg-red-500/15 border-red-500/40 text-red-300',
    waitlisted: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
}

const TEAM_STATUS_OPTIONS: { value: EventTeamStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'registered', label: 'Registered' },
    { value: 'waitlisted', label: 'Waitlisted' },
    { value: 'withdrawn', label: 'Withdrawn' },
    { value: 'disqualified', label: 'Disqualified' },
]

const AUDIT_ACTION_LABELS: Record<string, string> = {
    team_created: 'created a team',
    invited: 'invited a partner',
    accepted: 'accepted an invitation',
    declined: 'declined an invitation',
    team_updated: 'updated their team',
    team_deleted: 'deleted their team',
    lfp_joined: 'joined the LFP list',
    volunteered: 'signed up as a volunteer',
    manager_granted: 'granted event manager',
    manager_revoked: 'revoked event manager',
    admin_team_updated: 'updated a team (manager)',
    admin_team_deleted: 'deleted a team (manager)',
    admin_member_kicked: 'kicked a member (manager)',
    admin_lfp_removed: 'removed an LFP entry (manager)',
}

function TeamStatusChip({ status }: { status: EventTeamStatus }) {
    return (
        <span className={cn('px-2 py-0.5 rounded-md border text-[11px] font-medium capitalize', TEAM_STATUS_STYLES[status])}>
            {status}
        </span>
    )
}

function MemberRow({ member, busy, onKick }: {
    member: EventTeamMember
    busy: boolean
    onKick: (() => void) | null
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <PlayerInfo userId={member.user} alias={member.alias} size="sm" />
            {member.role === 'captain' && (
                <span className="px-1.5 py-0.5 rounded bg-accent-500/15 border border-accent-500/40 text-accent-300 text-[10px] font-medium">Captain</span>
            )}
            {member.status === 'invited' && (
                <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/20 text-muted-foreground text-[10px]">Invited</span>
            )}
            <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground min-w-0">
                {member.timezone && <span className="inline-flex items-center gap-1"><Globe className="size-3" />{member.timezone}</span>}
                {member.availability && <span className="inline-flex items-center gap-1 min-w-0"><Clock className="size-3 shrink-0" /><span className="truncate">{member.availability}</span></span>}
            </div>
            {onKick && (
                <button
                    onClick={onKick}
                    disabled={busy}
                    className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-500/30 text-red-300 text-[11px] hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                    <UserMinus className="size-3" /> Kick
                </button>
            )}
        </div>
    )
}

interface SignupsPanelProps {
    accessToken: string
    slug: string
    event: EventDetail
    lfp: EventLfpEntry[]
    teams: EventTeam[]
    onReloadTeams: () => Promise<void>
    onRefresh: () => void
}

export function SignupsPanel({ accessToken, slug, event, lfp, teams, onReloadTeams, onRefresh }: SignupsPanelProps) {
    const [volunteers, setVolunteers] = useState<EventVolunteerRow[]>([])
    const [audit, setAudit] = useState<{ items: EventAuditEntry[]; count: number } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const [renameTeamId, setRenameTeamId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<EventTeam | null>(null)
    const [kickTarget, setKickTarget] = useState<{ team: EventTeam; member: EventTeamMember } | null>(null)
    const [lfpRemoveTarget, setLfpRemoveTarget] = useState<EventLfpEntry | null>(null)

    const [openTeams, setOpenTeams] = useNavState('event.manage.teams', true)
    const [openVolunteers, setOpenVolunteers] = useNavState('event.manage.volunteers', false)
    const [openLfp, setOpenLfp] = useNavState('event.manage.lfp', false)
    const [openAudit, setOpenAudit] = useNavState('event.manage.audit', false)

    const load = useCallback(async () => {
        setError(null)
        try {
            const [volunteersData, auditData] = await Promise.all([
                fetchEventVolunteers(accessToken, slug),
                fetchEventAuditLog(accessToken, slug, { limit: 15 }),
            ])
            setVolunteers(volunteersData)
            setAudit(auditData)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }, [accessToken, slug])

    useEffect(() => { void load() }, [load])

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true)
        setError(null)
        try {
            await action()
            await Promise.all([load(), onReloadTeams()])
            onRefresh()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const saveRename = (team: EventTeam) => {
        const name = renameValue.trim()
        if (!name || name === team.name) {
            setRenameTeamId(null)
            return
        }
        void run(async () => {
            await updateEventAdminTeam(accessToken, slug, team.id, { name })
            setRenameTeamId(null)
        })
    }

    if (loading) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Loading management data…</div>
    }

    return (
        <div className="space-y-4">
            <ErrorBanner message={error} />

            <SectionCard
                title="Teams"
                subtitle={`${teams.length} team${teams.length === 1 ? '' : 's'} across all statuses`}
                collapsible
                open={openTeams}
                onOpenChange={setOpenTeams}
            >
                {teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No teams yet.</p>
                ) : (
                    <div className="grid gap-3 items-start 2xl:grid-cols-2">
                        {teams.map((team) => (
                            <div key={team.id} className="rounded-lg border border-white/10 bg-card/40 p-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {renameTeamId === team.id ? (
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <input
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(team); if (e.key === 'Escape') setRenameTeamId(null) }}
                                                className={cn(teamInputClass, 'h-8 py-1 w-48')}
                                                autoFocus
                                            />
                                            <button onClick={() => saveRename(team)} disabled={busy} className="p-1.5 rounded-md text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"><Check className="size-4" /></button>
                                            <button onClick={() => setRenameTeamId(null)} className="p-1.5 rounded-md text-muted-foreground hover:bg-white/5 cursor-pointer"><X className="size-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-medium text-foreground">{team.name}</span>
                                            <button
                                                onClick={() => { setRenameTeamId(team.id); setRenameValue(team.name) }}
                                                className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer"
                                                title="Rename team"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                        </>
                                    )}
                                    <TeamStatusChip status={team.status} />
                                    {team.seed != null && (
                                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/20 text-muted-foreground text-[10px]">Seed {team.seed}</span>
                                    )}
                                    <div className="ml-auto flex items-center gap-2">
                                        <AdminSelect
                                            value={team.status}
                                            onChange={(v) => { void run(() => updateEventAdminTeam(accessToken, slug, team.id, { status: v as EventTeamStatus })) }}
                                            options={TEAM_STATUS_OPTIONS}
                                            ariaLabel={`Status of ${team.name}`}
                                            className="h-8 w-36"
                                        />
                                        <button
                                            onClick={() => setDeleteTarget(team)}
                                            disabled={busy}
                                            className="p-1.5 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                            title="Delete team"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {team.members.map((member) => (
                                        <MemberRow
                                            key={member.user}
                                            member={member}
                                            busy={busy}
                                            onKick={member.role === 'captain' ? null : () => setKickTarget({ team, member })}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <div className="grid gap-4 items-start xl:grid-cols-2 2xl:grid-cols-3">
            <SectionCard
                title="Volunteers"
                subtitle="Players and helpers who offered to stream, cast or admin"
                collapsible
                open={openVolunteers}
                onOpenChange={setOpenVolunteers}
            >
                {volunteers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No volunteers yet.</p>
                ) : (
                    <div className="space-y-2">
                        {volunteers.map((v) => (
                            <div key={v.user} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <PlayerInfo userId={v.user} alias={v.alias} size="sm" />
                                <div className="flex items-center gap-1.5">
                                    {v.streaming && <span className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[10px]">Streaming</span>}
                                    {v.casting && <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[10px]">Co-casting</span>}
                                    {v.admining && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px]">Admining</span>}
                                </div>
                                {v.note && <span className="text-[11px] text-muted-foreground italic min-w-0 truncate">"{v.note}"</span>}
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title="Looking for Partner"
                subtitle="Remove stale entries — joining a team removes players automatically"
                collapsible
                open={openLfp}
                onOpenChange={setOpenLfp}
            >
                {lfp.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nobody is looking for a partner right now.</p>
                ) : (
                    <div className="space-y-2">
                        {lfp.map((entry) => (
                            <div key={entry.user} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <PlayerInfo userId={entry.user} alias={entry.alias} size="sm" />
                                <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground min-w-0">
                                    {entry.timezone && <span className="inline-flex items-center gap-1"><Globe className="size-3" />{entry.timezone}</span>}
                                    {entry.availability && <span className="inline-flex items-center gap-1 min-w-0"><Clock className="size-3 shrink-0" /><span className="truncate">{entry.availability}</span></span>}
                                </div>
                                <button
                                    onClick={() => setLfpRemoveTarget(entry)}
                                    disabled={busy}
                                    className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-500/30 text-red-300 text-[11px] hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <UserMinus className="size-3" /> Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            {audit && audit.items.length > 0 && (
                <SectionCard
                    title="Recent activity"
                    subtitle={`${audit.count} logged action${audit.count === 1 ? '' : 's'} for this event`}
                    collapsible
                    open={openAudit}
                    onOpenChange={setOpenAudit}
                >
                    <div className="space-y-1.5">
                        {audit.items.map((entry) => (
                            <div key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                                <span className="text-foreground">{entry.actor_alias ?? entry.actor ?? 'Unknown'}</span>
                                <span className="text-muted-foreground">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</span>
                                {entry.target_alias && <span className="text-foreground">&rarr; {entry.target_alias}</span>}
                                <span className="text-muted-foreground/60 ml-auto">{formatEventDateTime(entry.created_at)}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (!deleteTarget) return
                    const team = deleteTarget
                    setDeleteTarget(null)
                    void run(() => deleteEventAdminTeam(accessToken, slug, team.id))
                }}
                title="Delete team"
                message={`Delete "${deleteTarget?.name}" from ${event.name}?`}
                detail="The team and all its members are removed permanently."
                confirmText="Delete team"
                variant="error"
            />
            <ConfirmModal
                isOpen={!!kickTarget}
                onClose={() => setKickTarget(null)}
                onConfirm={() => {
                    if (!kickTarget) return
                    const { team, member } = kickTarget
                    setKickTarget(null)
                    void run(() => kickEventTeamMember(accessToken, slug, team.id, member.user))
                }}
                title="Kick member"
                message={`Kick ${kickTarget?.member.alias ?? kickTarget?.member.user} from "${kickTarget?.team.name}"?`}
                detail="A registered team dropping below the required size goes back to pending."
                confirmText="Kick"
                variant="error"
            />
            <ConfirmModal
                isOpen={!!lfpRemoveTarget}
                onClose={() => setLfpRemoveTarget(null)}
                onConfirm={() => {
                    if (!lfpRemoveTarget) return
                    const entry = lfpRemoveTarget
                    setLfpRemoveTarget(null)
                    void run(() => removeEventLfp(accessToken, slug, entry.user))
                }}
                title="Remove from LFP"
                message={`Remove ${lfpRemoveTarget?.alias ?? lfpRemoveTarget?.user} from the looking-for-partner list?`}
                confirmText="Remove"
                variant="error"
            />
        </div>
    )
}
