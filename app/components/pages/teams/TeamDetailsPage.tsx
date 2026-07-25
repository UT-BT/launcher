import { useCallback, useEffect, useRef, useState } from 'react'
import { requestLogin } from '@/app/components/shared/AuthRequiredModal'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    acceptTeamInvite, declineTeamInvite, fetchMyTeam, fetchTeam, joinTeam,
    type TeamDetail, type TeamRole, type UserProfile,
} from '@/app/utils/api'
import { TeamHeaderCard } from './TeamHeaderCard'
import { MembersPanel } from './MembersPanel'
import { TeamStatsRow } from './TeamStatsRow'
import { TeamActivityPanel } from './TeamActivityPanel'
import { TeamWorldRecordsPanel } from './TeamWorldRecordsPanel'
import { ErrorBanner, teamErrorMessage } from './teamsShared'

type ViewerRole = TeamRole | 'none'

interface TeamDetailsPageProps {
    teamId: string
    userProfile?: UserProfile
    onExitToGallery: () => void
}

export function TeamDetailsPage({ teamId, userProfile, onExitToGallery }: TeamDetailsPageProps) {
    const accessToken = userProfile?.accessToken
    const browseToken = accessToken ?? ''
    const myUserId = userProfile?.id ?? undefined

    const [team, setTeam] = useState<TeamDetail | null>(null)
    const [myTeamId, setMyTeamId] = useState<string | null>(null)
    const [hasTeam, setHasTeam] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [joining, setJoining] = useState(false)
    const [inviteBusy, setInviteBusy] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useDocumentTitle(team?.name, SITE_NAME)

    const load = useCallback(async (background = false) => {
        if (!background) setLoading(true)
        setError(null)
        try {
            const [detail, mine] = await Promise.all([
                fetchTeam(browseToken, teamId),
                accessToken ? fetchMyTeam(accessToken) : Promise.resolve(null),
            ])
            setTeam(detail)
            setMyTeamId(mine?.id ?? null)
            setHasTeam(mine != null)
        } catch (e) {
            if (!background) setError(teamErrorMessage(e))
        } finally {
            if (!background) setLoading(false)
        }
    }, [accessToken, browseToken, teamId])

    useEffect(() => { void load() }, [load])

    useRegisterPageRefresh({
        onRefresh: () => void load(),
        refreshing: loading,
        tooltip: 'Refresh',
    })

    const onScroll = useNavScrollRestore(scrollRef, !loading)

    const isOwnTeam = team != null && myTeamId != null && myTeamId === team.id
    const myMembership = team ? team.members.find(m => String(m.user) === String(myUserId)) : undefined
    const iInvited = myMembership?.status === 'invited'
    const iBlocked = myMembership?.status === 'blocked'
    const meMember = isOwnTeam ? myMembership : undefined
    const viewerRole: ViewerRole = isOwnTeam ? (meMember?.role ?? 'member') : 'none'
    const isOwner = viewerRole === 'owner'
    const isManager = viewerRole === 'owner' || viewerRole === 'admin'
    const canLeave = isOwnTeam && !isOwner
    const hasOtherActiveMembers = team ? team.members.some(m => m.status === 'active' && String(m.user) !== String(myUserId)) : false

    const join = async () => {
        if (!accessToken || !team) return
        setJoining(true)
        setError(null)
        try {
            await joinTeam(accessToken, team.id)
            onExitToGallery()
        } catch (e) {
            setError(teamErrorMessage(e))
            setJoining(false)
        }
    }

    const accept = async () => {
        if (!accessToken || !team) return
        setInviteBusy(true)
        setError(null)
        try {
            await acceptTeamInvite(accessToken, team.id)
            onExitToGallery()
        } catch (e) {
            setError(teamErrorMessage(e))
            setInviteBusy(false)
        }
    }

    const decline = async () => {
        if (!accessToken || !team) return
        setInviteBusy(true)
        setError(null)
        try {
            await declineTeamInvite(accessToken, team.id)
            onExitToGallery()
        } catch (e) {
            setError(teamErrorMessage(e))
            setInviteBusy(false)
        }
    }

    const joinControl = (() => {
        if (!team || isOwnTeam) return undefined

        if (!accessToken) {
            return team.is_open
                ? <Button size="sm" onClick={() => requestLogin({ feature: 'join this team' })}>Join</Button>
                : undefined
        }

        if (iInvited) {
            const acceptBtn = (
                <Button size="sm" disabled={inviteBusy || hasTeam} onClick={accept}>
                    {inviteBusy ? 'Working…' : 'Accept'}
                </Button>
            )
            return (
                <div className="flex items-center gap-2">
                    {hasTeam
                        ? <Tooltip content="Leave your current team to accept">{acceptBtn}</Tooltip>
                        : acceptBtn}
                    <Button size="sm" variant="secondary" disabled={inviteBusy} onClick={decline}>Decline</Button>
                </div>
            )
        }

        if (iBlocked) {
            return <span className="text-xs text-red-300/80">Blocked from joining</span>
        }

        if (!team.is_open) return undefined

        if (hasTeam) {
            return (
                <Tooltip content="Leave your current team to join">
                    <Button size="sm" disabled>Join</Button>
                </Tooltip>
            )
        }

        return (
            <Button size="sm" disabled={joining} onClick={join}>
                {joining ? 'Joining…' : 'Join'}
            </Button>
        )
    })()

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">
            {error && <div className="shrink-0"><ErrorBanner message={error} /></div>}

            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 min-h-0 overflow-auto px-0.5 pb-2"
            >
                {loading && !team ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading team…</div>
                ) : !team ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">This team could not be found.</div>
                ) : (
                    <div className="space-y-4">
                        <TeamHeaderCard
                            accessToken={browseToken}
                            team={team}
                            isOwner={isOwner}
                            isOwnTeam={isOwnTeam}
                            canLeave={canLeave}
                            canTransfer={isOwner && hasOtherActiveMembers}
                            rightExtra={joinControl}
                            userProfile={userProfile}
                            onTeamChange={setTeam}
                            onLeftOrDisbanded={onExitToGallery}
                        />
                        <TeamStatsRow accessToken={browseToken} team={team} />

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                            <div className="xl:col-span-4">
                                <MembersPanel
                                    accessToken={browseToken}
                                    team={team}
                                    isOwner={isOwner}
                                    isManager={isManager}
                                    onTeamChange={setTeam}
                                />
                            </div>
                            <div className="xl:col-span-8 space-y-4">
                                <TeamActivityPanel
                                    accessToken={browseToken}
                                    teamId={team.id}
                                    hasMembers={team.members.some(m => m.status === 'active')}
                                    selfUserId={myUserId}
                                />
                                <TeamWorldRecordsPanel
                                    accessToken={browseToken}
                                    teamId={team.id}
                                    memberIds={team.members.filter(m => m.status === 'active').map(m => m.user)}
                                    selfUserId={myUserId}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
