import { useState } from 'react'
import { Crown, Check, X, ShieldCheck, ShieldOff, UserMinus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    approveTeamMember, denyTeamMember, inviteToTeam, kickTeamMember, setTeamMemberRole,
    type PlayerListRow, type TeamDetail, type TeamMember,
} from '@/app/utils/api'
import { ErrorBanner, RoleBadge, SectionCard, StatusBadge, teamErrorMessage } from './teamsShared'
import { PlayerSearchInput } from './PlayerSearchInput'

interface MembersPanelProps {
    accessToken: string
    team: TeamDetail
    isOwner: boolean
    isManager: boolean
    onTeamChange: (team: TeamDetail) => void
}

const STATUS_ORDER: Record<TeamMember['status'], number> = { applied: 0, invited: 1, active: 2 }
const ROLE_ORDER: Record<TeamMember['role'], number> = { owner: 0, admin: 1, member: 2 }

function sortMembers(members: TeamMember[]): TeamMember[] {
    return [...members].sort((a, b) => {
        if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (a.role !== b.role) return ROLE_ORDER[a.role] - ROLE_ORDER[b.role]
        return (a.alias || a.user).localeCompare(b.alias || b.user)
    })
}

export function MembersPanel({ accessToken, team, isOwner, isManager, onTeamChange }: MembersPanelProps) {
    const [busyUser, setBusyUser] = useState<string | null>(null)
    const [inviting, setInviting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const excludeIds = new Set(team.members.map(m => String(m.user)))

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

    const members = sortMembers(team.members)
    const activeCount = team.members.filter(m => m.status === 'active').length

    return (
        <SectionCard title="Members" subtitle={`${activeCount} active ${activeCount === 1 ? 'member' : 'members'}`}>
            {isManager && (
                <div className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Invite a player</span>
                    <PlayerSearchInput
                        accessToken={accessToken}
                        onPick={invite}
                        excludeIds={excludeIds}
                        disabled={inviting}
                    />
                </div>
            )}

            <ErrorBanner message={error} />

            <div className="space-y-2">
                {members.map(member => {
                    const busy = busyUser === member.user
                    const isMemberOwner = member.role === 'owner'
                    return (
                        <div
                            key={member.user}
                            className="flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg"
                        >
                            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                <PlayerInfo userId={member.user} alias={member.alias} size="sm" />
                                <RoleBadge role={member.role} />
                                {member.status !== 'active' && <StatusBadge status={member.status} />}
                                {member.tagged_alias && member.status === 'active' && (
                                    <span className="text-[11px] text-muted-foreground font-mono truncate">
                                        {member.tagged_alias}
                                    </span>
                                )}
                            </div>

                            {isManager && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {member.status === 'applied' && (
                                        <>
                                            <Tooltip content="Approve">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busy}
                                                    onClick={() => run(member.user, () => approveTeamMember(accessToken, team.id, member.user))}
                                                    className="text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 px-2"
                                                >
                                                    <Check className="size-4" />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="Deny">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busy}
                                                    onClick={() => run(member.user, () => denyTeamMember(accessToken, team.id, member.user))}
                                                    className="text-red-300 hover:text-red-200 hover:bg-red-500/10 px-2"
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </Tooltip>
                                        </>
                                    )}

                                    {member.status === 'invited' && (
                                        <Tooltip content="Cancel invite">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={busy}
                                                onClick={() => run(member.user, () => denyTeamMember(accessToken, team.id, member.user))}
                                                className="text-red-300 hover:text-red-200 hover:bg-red-500/10 px-2"
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        </Tooltip>
                                    )}

                                    {member.status === 'active' && !isMemberOwner && (
                                        <>
                                            {isOwner && member.role === 'member' && (
                                                <Tooltip content="Promote to admin">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busy}
                                                        onClick={() => run(member.user, () => setTeamMemberRole(accessToken, team.id, member.user, 'admin'))}
                                                        className="text-accent-300 hover:text-accent-200 hover:bg-accent-500/10 px-2"
                                                    >
                                                        <ShieldCheck className="size-4" />
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {isOwner && member.role === 'admin' && (
                                                <Tooltip content="Demote to member">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busy}
                                                        onClick={() => run(member.user, () => setTeamMemberRole(accessToken, team.id, member.user, 'member'))}
                                                        className="text-muted-foreground hover:text-white hover:bg-white/5 px-2"
                                                    >
                                                        <ShieldOff className="size-4" />
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            <Tooltip content="Kick from team">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busy}
                                                    onClick={() => run(member.user, () => kickTeamMember(accessToken, team.id, member.user))}
                                                    className="text-red-300 hover:text-red-200 hover:bg-red-500/10 px-2"
                                                >
                                                    <UserMinus className="size-4" />
                                                </Button>
                                            </Tooltip>
                                        </>
                                    )}

                                    {isMemberOwner && (
                                        <Crown className="size-4 text-yellow-300" />
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </SectionCard>
    )
}
