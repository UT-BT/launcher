import { useEffect, useMemo, useState } from 'react'
import {
    Crown, Sword, Check, X, Ban, RotateCcw, ShieldCheck, ShieldOff, UserMinus,
    Inbox, UserCog, History, UserPlus, LogOut, ArrowRightLeft, Pencil, Flag, Hash, ImagePlus, EyeOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Modal } from '@/app/components/ui/modal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { formatTimeAgo } from '@/app/utils/format'
import {
    denyTeamMember, fetchTeamAudit, inviteToTeam, kickTeamMember, setTeamMemberNumber, setTeamMemberRole, unblockTeamMember,
    type PlayerListRow, type TeamAuditEntry, type TeamDetail, type TeamMember, type TeamRole,
} from '@/app/utils/api'
import { ErrorBanner, SectionCard, StatusBadge, memberTitle, teamErrorMessage, teamInputClass } from './teamsShared'
import { memberNumberValidationError } from './tagFormat'
import { PlayerSearchInput } from './PlayerSearchInput'

interface MembersPanelProps {
    accessToken: string
    team: TeamDetail
    isOwner: boolean
    isManager: boolean
    onTeamChange: (team: TeamDetail) => void
}

const ROLE_ORDER: Record<TeamRole, number> = { owner: 0, admin: 1, member: 2 }
const PENDING_ORDER: Record<string, number> = { invited: 0, blocked: 1 }

function RoleSlot({ role }: { role: TeamRole }) {
    if (role === 'owner') return <Tooltip content="Owner"><Crown className="size-4 text-yellow-300 shrink-0" /></Tooltip>
    if (role === 'admin') return <Tooltip content="Moderator"><Sword className="size-4 text-emerald-300 shrink-0" /></Tooltip>
    return <span className="size-4 shrink-0" aria-hidden />
}

const AUDIT_META: Record<string, { icon: LucideIcon; tone: string; text: (actor: string, target: string) => string }> = {
    create: { icon: Flag, tone: 'text-accent-300', text: a => `${a} created the team` },
    update: { icon: Pencil, tone: 'text-muted-foreground', text: a => `${a} updated team settings` },
    invite: { icon: UserPlus, tone: 'text-accent-300', text: (a, t) => `${a} invited ${t}` },
    apply: { icon: UserPlus, tone: 'text-amber-300', text: a => `${a} applied to join` },
    withdraw: { icon: X, tone: 'text-muted-foreground', text: a => `${a} withdrew their application` },
    decline: { icon: X, tone: 'text-muted-foreground', text: a => `${a} declined their invitation` },
    join: { icon: Check, tone: 'text-emerald-300', text: a => `${a} joined the team` },
    approve: { icon: Check, tone: 'text-emerald-300', text: (a, t) => `${a} approved ${t}` },
    deny: { icon: X, tone: 'text-red-300', text: (a, t) => `${a} denied ${t}` },
    block: { icon: Ban, tone: 'text-red-300', text: (a, t) => `${a} blocked ${t}` },
    unblock: { icon: RotateCcw, tone: 'text-muted-foreground', text: (a, t) => `${a} unblocked ${t}` },
    kick: { icon: UserMinus, tone: 'text-red-300', text: (a, t) => `${a} kicked ${t}` },
    promote: { icon: ShieldCheck, tone: 'text-emerald-300', text: (a, t) => `${a} promoted ${t} to moderator` },
    demote: { icon: ShieldOff, tone: 'text-muted-foreground', text: (a, t) => `${a} demoted ${t} to member` },
    transfer: { icon: ArrowRightLeft, tone: 'text-yellow-300', text: (a, t) => `${a} transferred ownership to ${t}` },
    leave: { icon: LogOut, tone: 'text-muted-foreground', text: a => `${a} left the team` },
    number: { icon: Hash, tone: 'text-accent-300', text: (a, t) => `${a} changed ${t}'s number` },
    avatar: { icon: ImagePlus, tone: 'text-accent-300', text: a => `${a} changed the team image` },
}

function IconButton({ tooltip, icon: Icon, count }: { tooltip: string; icon: LucideIcon; count?: number }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {count != null && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500/20 text-accent-200 border border-accent-500/40">{count}</span>}
            <span className="sr-only">{tooltip}</span>
        </span>
    )
}

export function MembersPanel({ accessToken, team, isOwner, isManager, onTeamChange }: MembersPanelProps) {
    const [busyUser, setBusyUser] = useState<string | null>(null)
    const [inviting, setInviting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [requestsOpen, setRequestsOpen] = useState(false)
    const [manageOpen, setManageOpen] = useState(false)
    const [numbersOpen, setNumbersOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [audit, setAudit] = useState<TeamAuditEntry[]>([])
    const [auditLoading, setAuditLoading] = useState(false)
    const [auditError, setAuditError] = useState<string | null>(null)

    const excludeIds = new Set(team.members.map(m => String(m.user)))

    const activeMembers = useMemo(
        () => team.members
            .filter(m => m.status === 'active')
            .sort((a, b) => (a.role !== b.role ? ROLE_ORDER[a.role] - ROLE_ORDER[b.role] : (a.alias || a.user).localeCompare(b.alias || b.user))),
        [team.members],
    )
    const manageable = useMemo(
        () => activeMembers.filter(m => m.role !== 'owner' && (isOwner || m.role === 'member')),
        [activeMembers, isOwner],
    )
    const pending = useMemo(
        () => team.members
            .filter(m => m.status !== 'active')
            .sort((a, b) => (a.status !== b.status ? PENDING_ORDER[a.status] - PENDING_ORDER[b.status] : (a.alias || a.user).localeCompare(b.alias || b.user))),
        [team.members],
    )

    useEffect(() => {
        if (!historyOpen) return
        let cancelled = false
        setAuditLoading(true)
        setAuditError(null)
        fetchTeamAudit(accessToken, team.id, { limit: 100 })
            .then(rows => { if (!cancelled) setAudit(rows) })
            .catch(e => { if (!cancelled) setAuditError(teamErrorMessage(e)) })
            .finally(() => { if (!cancelled) setAuditLoading(false) })
        return () => { cancelled = true }
    }, [historyOpen, accessToken, team.id, team.members])

    const run = async (user: string, fn: () => Promise<TeamDetail>) => {
        setBusyUser(user)
        setError(null)
        try {
            onTeamChange(await fn())
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setBusyUser(null)
        }
    }

    const invite = async (player: PlayerListRow) => {
        setInviting(true)
        setError(null)
        try {
            onTeamChange(await inviteToTeam(accessToken, team.id, String(player.id)))
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setInviting(false)
        }
    }

    const usesNumbers = team.tag_style !== 'plain'

    const headerActions = isManager ? (
        <div className="flex items-center gap-1.5 shrink-0">
            {pending.length > 0 && (
                <Tooltip content="Requests">
                    <Button size="sm" variant="secondary" onClick={() => setRequestsOpen(true)}>
                        <IconButton tooltip="Requests" icon={Inbox} count={pending.length} />
                    </Button>
                </Tooltip>
            )}
            {usesNumbers && (
                <Tooltip content="Member numbers">
                    <Button size="sm" variant="secondary" onClick={() => setNumbersOpen(true)}>
                        <IconButton tooltip="Member numbers" icon={Hash} />
                    </Button>
                </Tooltip>
            )}
            {manageable.length > 0 && (
                <Tooltip content="Manage members">
                    <Button size="sm" variant="secondary" onClick={() => setManageOpen(true)}>
                        <IconButton tooltip="Manage members" icon={UserCog} />
                    </Button>
                </Tooltip>
            )}
            <Tooltip content="Audit log">
                <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)}>
                    <IconButton tooltip="Audit log" icon={History} />
                </Button>
            </Tooltip>
        </div>
    ) : undefined

    return (
        <SectionCard
            title="Members"
            subtitle={`${activeMembers.length} active ${activeMembers.length === 1 ? 'member' : 'members'}`}
            action={headerActions}
        >
            {isManager && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Invite a player</span>
                    <PlayerSearchInput accessToken={accessToken} onPick={invite} excludeIds={excludeIds} disabled={inviting} />
                </div>
            )}

            <ErrorBanner message={error} />

            <div className="space-y-2">
                {activeMembers.map(member => (
                    <div key={member.user} className="flex items-center gap-2.5 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
                        <RoleSlot role={member.role} />
                        <PlayerInfo userId={member.user} alias={member.alias} title={memberTitle(member.title)} size="sm" />
                        {member.tag_hidden && (
                            <Tooltip content="Wearing no clan tag by choice">
                                <EyeOff className="size-3.5 text-muted-foreground/60 shrink-0 ml-auto" />
                            </Tooltip>
                        )}
                    </div>
                ))}
            </div>

            {isManager && (
                <Modal isOpen={requestsOpen} onClose={() => setRequestsOpen(false)} title="Requests" offsetSidebar maxWidth="34rem" footer={null}>
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">Pending invitations, and players blocked from joining.</p>
                        <ErrorBanner message={error} />
                        {pending.length === 0 ? (
                            <EmptyState icon={Inbox} title="Nothing pending" hint="Applications and invites will appear here." />
                        ) : (
                            <div className="space-y-2">
                                {pending.map(member => {
                                    const busy = busyUser === member.user
                                    return (
                                        <div key={member.user} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
                                            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                                <PlayerInfo userId={member.user} alias={member.alias} title={memberTitle(member.title)} size="sm" />
                                                <StatusBadge status={member.status} />
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {member.status === 'invited' && (
                                                    <ActionButton tooltip="Cancel invite" icon={X} tone="red" busy={busy} onClick={() => run(member.user, () => denyTeamMember(accessToken, team.id, member.user))} />
                                                )}
                                                {member.status === 'blocked' && (
                                                    <ActionButton tooltip="Unblock" icon={RotateCcw} tone="muted" busy={busy} onClick={() => run(member.user, () => unblockTeamMember(accessToken, team.id, member.user))} />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {isManager && (
                <Modal isOpen={manageOpen} onClose={() => setManageOpen(false)} title="Manage Members" offsetSidebar maxWidth="34rem" footer={null}>
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            {isOwner ? 'Promote members to moderator, demote, or remove them.' : 'Remove members from the team.'}
                        </p>
                        <ErrorBanner message={error} />
                        {manageable.length === 0 ? (
                            <EmptyState icon={UserCog} title="No other members" hint="Invite players to build your roster." />
                        ) : (
                            <div className="space-y-2">
                                {manageable.map(member => {
                                    const busy = busyUser === member.user
                                    return (
                                        <div key={member.user} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
                                            <div className="min-w-0 flex-1 flex items-center gap-2">
                                                <RoleSlot role={member.role} />
                                                <PlayerInfo userId={member.user} alias={member.alias} title={memberTitle(member.title)} size="sm" />
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {isOwner && member.role === 'member' && (
                                                    <ActionButton tooltip="Promote to moderator" icon={ShieldCheck} tone="emerald" busy={busy} onClick={() => run(member.user, () => setTeamMemberRole(accessToken, team.id, member.user, 'admin'))} />
                                                )}
                                                {isOwner && member.role === 'admin' && (
                                                    <ActionButton tooltip="Demote to member" icon={ShieldOff} tone="muted" busy={busy} onClick={() => run(member.user, () => setTeamMemberRole(accessToken, team.id, member.user, 'member'))} />
                                                )}
                                                {(isOwner || member.role === 'member') && (
                                                    <>
                                                        <ActionButton tooltip="Kick from team" icon={UserMinus} tone="red" busy={busy} onClick={() => run(member.user, () => kickTeamMember(accessToken, team.id, member.user))} />
                                                        <ActionButton tooltip="Kick & block from rejoining" icon={Ban} tone="red" busy={busy} onClick={() => run(member.user, () => kickTeamMember(accessToken, team.id, member.user, true))} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {isManager && usesNumbers && (
                <Modal isOpen={numbersOpen} onClose={() => setNumbersOpen(false)} title="Member Numbers" offsetSidebar maxWidth="34rem" footer={null}>
                    <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">
                            {team.tag_style === 'number_only'
                                ? `Each member plays as ${team.tag}<number>. Numbers must be unique within the team.`
                                : `Each member's number is appended to ${team.tag}. Numbers must be unique within the team.`}
                        </p>
                        <ErrorBanner message={error} />
                        <div className="space-y-2">
                            {activeMembers.map(member => (
                                <MemberNumberRow
                                    key={`${member.user}:${member.tag_number}`}
                                    member={member}
                                    busy={busyUser === member.user}
                                    onCommit={value => run(member.user, () => setTeamMemberNumber(accessToken, team.id, member.user, value))}
                                />
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {isManager && (
                <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Audit Log" offsetSidebar maxWidth="36rem" footer={null}>
                    <div className="space-y-3">
                        <ErrorBanner message={auditError} />
                        {auditLoading ? (
                            <div className="space-y-1.5">
                                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-8 bg-hairline/5 rounded-lg animate-pulse" />)}
                            </div>
                        ) : audit.length === 0 ? (
                            <EmptyState icon={History} title="No history yet" hint="Team actions will be recorded here." />
                        ) : (
                            <div className="divide-y divide-hairline/5 -my-1 max-h-[26rem] overflow-y-auto">
                                {audit.map(entry => {
                                    const meta = AUDIT_META[entry.action]
                                    const Icon = meta?.icon ?? History
                                    const actor = entry.actor_alias || entry.actor || 'Someone'
                                    const target = entry.target_alias || entry.target || 'someone'
                                    const text = meta ? meta.text(actor, target) : `${actor} · ${entry.action}`
                                    return (
                                        <div key={entry.id} className="flex items-center gap-2.5 py-2 min-w-0">
                                            <Icon className={cnTone(meta?.tone)} />
                                            <span className="min-w-0 flex-1 text-[13px] text-muted-foreground truncate">{text}</span>
                                            <span className="text-[11px] text-muted-foreground/70 shrink-0 tabular-nums">{entry.created_at ? formatTimeAgo(entry.created_at) : ''}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </SectionCard>
    )
}

function cnTone(tone?: string) {
    return `size-3.5 shrink-0 ${tone ?? 'text-muted-foreground'}`
}

function MemberNumberRow({ member, busy, onCommit }: {
    member: TeamMember
    busy: boolean
    onCommit: (value: number | null) => void
}) {
    const stored = member.tag_number == null ? '' : String(member.tag_number)
    const [draft, setDraft] = useState(stored)
    const [touched, setTouched] = useState(false)

    const current = touched ? draft : stored
    const validationError = memberNumberValidationError(current)

    // On success the row is remounted by its key (which includes tag_number), resetting the
    // draft. On failure it is not, so the typed value survives for the user to correct.
    const commit = () => {
        if (validationError || current.trim() === stored) return
        onCommit(current.trim() === '' ? null : Number(current.trim()))
    }

    return (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
            <div className="min-w-0 flex-1 flex items-center gap-2">
                <RoleSlot role={member.role} />
                <PlayerInfo userId={member.user} alias={member.alias} title={memberTitle(member.title)} size="sm" />
            </div>
            <div className="shrink-0 flex flex-col items-end gap-0.5">
                <input
                    value={current}
                    disabled={busy}
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="—"
                    aria-label={`Number for ${member.alias ?? member.user}`}
                    onChange={e => { setTouched(true); setDraft(e.target.value) }}
                    onBlur={commit}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    className={cn(teamInputClass, 'w-16 text-center tabular-nums py-1.5', validationError && 'border-red-500/50')}
                />
                {validationError && <span className="text-[10px] text-red-400">{validationError}</span>}
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Icon className="size-6 text-muted-foreground/50" />
            <p className="text-sm text-foreground/80">{title}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
    )
}

const TONE_CLASS: Record<string, string> = {
    emerald: 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10',
    red: 'text-red-300 hover:text-red-200 hover:bg-red-500/10',
    muted: 'text-muted-foreground hover:text-white hover:bg-white/5',
}

function ActionButton({ tooltip, icon: Icon, tone, busy, onClick }: {
    tooltip: string
    icon: LucideIcon
    tone: keyof typeof TONE_CLASS
    busy: boolean
    onClick: () => void
}) {
    return (
        <Tooltip content={tooltip}>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onClick} className={`px-2 ${TONE_CLASS[tone]}`}>
                <Icon className="size-4" />
            </Button>
        </Tooltip>
    )
}
