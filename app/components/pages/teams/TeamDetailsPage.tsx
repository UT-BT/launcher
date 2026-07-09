import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { BackButton } from '@/app/components/shared/BackButton'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    applyToTeam, fetchMyTeam, fetchTeam,
    type TeamDetail, type TeamRole, type UserProfile,
} from '@/app/utils/api'
import { TeamHeaderCard } from './TeamHeaderCard'
import { MembersPanel } from './MembersPanel'
import { LineupsPanel } from './LineupsPanel'
import { ErrorBanner, teamErrorMessage } from './teamsShared'

type ViewerRole = TeamRole | 'none'

interface TeamDetailsPageProps {
    teamId: string
    userProfile?: UserProfile
    onBack: () => void
    onExitToGallery: () => void
}

export function TeamDetailsPage({ teamId, userProfile, onBack, onExitToGallery }: TeamDetailsPageProps) {
    const accessToken = userProfile?.accessToken
    const myUserId = userProfile?.id ?? undefined

    const [team, setTeam] = useState<TeamDetail | null>(null)
    const [myTeamId, setMyTeamId] = useState<string | null>(null)
    const [hasTeam, setHasTeam] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [applying, setApplying] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const load = useCallback(async (background = false) => {
        if (!accessToken) return
        if (!background) setLoading(true)
        setError(null)
        try {
            const [detail, mine] = await Promise.all([
                fetchTeam(accessToken, teamId),
                fetchMyTeam(accessToken),
            ])
            setTeam(detail)
            setMyTeamId(mine?.id ?? null)
            setHasTeam(mine != null)
        } catch (e) {
            if (!background) setError(teamErrorMessage(e))
        } finally {
            if (!background) setLoading(false)
        }
    }, [accessToken, teamId])

    useEffect(() => { void load() }, [load])

    useRegisterPageRefresh({
        onRefresh: () => void load(),
        refreshing: loading,
        tooltip: 'Refresh',
    })

    const onScroll = useNavScrollRestore(scrollRef, !loading)

    const isOwnTeam = team != null && myTeamId != null && myTeamId === team.id
    const meMember = isOwnTeam && team ? team.members.find(m => String(m.user) === String(myUserId)) : undefined
    const viewerRole: ViewerRole = isOwnTeam ? (meMember?.role ?? 'member') : 'none'
    const isOwner = viewerRole === 'owner'
    const isManager = viewerRole === 'owner' || viewerRole === 'admin'
    const soleActiveMember = team ? team.members.filter(m => m.status === 'active').length <= 1 : false
    const canLeave = isOwnTeam && !(isOwner && soleActiveMember)

    const apply = async () => {
        if (!accessToken || !team) return
        setApplying(true)
        setError(null)
        try {
            await applyToTeam(accessToken, team.id)
            onExitToGallery()
        } catch (e) {
            setError(teamErrorMessage(e))
            setApplying(false)
        }
    }

    const applyControl = team && !isOwnTeam && team.is_open
        ? hasTeam
            ? (
                <Tooltip content="Leave your current team to apply">
                    <Button size="sm" disabled>Apply</Button>
                </Tooltip>
            )
            : (
                <Button size="sm" disabled={applying} onClick={apply}>
                    {applying ? 'Applying…' : 'Apply'}
                </Button>
            )
        : undefined

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">
            <div className="shrink-0">
                <BackButton onClick={onBack} />
            </div>

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
                            accessToken={accessToken!}
                            team={team}
                            isOwner={isOwner}
                            isManager={isManager}
                            isOwnTeam={isOwnTeam}
                            canLeave={canLeave}
                            rightExtra={applyControl}
                            userProfile={userProfile}
                            onTeamChange={setTeam}
                            onLeftOrDisbanded={onExitToGallery}
                        />
                        <div className="grid gap-4 lg:grid-cols-2 items-start">
                            <MembersPanel
                                accessToken={accessToken!}
                                team={team}
                                isOwner={isOwner}
                                isManager={isManager}
                                onTeamChange={setTeam}
                            />
                            <LineupsPanel
                                accessToken={accessToken!}
                                team={team}
                                canManage={isManager}
                                onTeamChange={setTeam}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
