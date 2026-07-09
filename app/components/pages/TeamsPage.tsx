import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import {
    fetchMyInvitations, fetchMyTeam,
    type TeamCore, type TeamDetail, type UserProfile,
} from '@/app/utils/api'
import { CreateTeamForm } from './teams/CreateTeamForm'
import { TeamGallery } from './teams/TeamGallery'
import { InvitationsSection } from './teams/InvitationsSection'
import { ErrorBanner, refreshUserProfile, teamErrorMessage } from './teams/teamsShared'

export interface TeamsPageState {
    directorySearch: string
    directoryPage: number
    scrollTop: number
}

export interface TeamsPageCaches {
    myTeam: TeamDetail | null
    invitations: TeamCore[]
    loaded: boolean
    lastRefreshIso: string | null
}

export const DEFAULT_TEAMS_STATE: TeamsPageState = {
    directorySearch: '',
    directoryPage: 1,
    scrollTop: 0,
}

export const DEFAULT_TEAMS_CACHES: TeamsPageCaches = {
    myTeam: null,
    invitations: [],
    loaded: false,
    lastRefreshIso: null,
}

interface TeamsPageProps {
    userProfile?: UserProfile
    state: TeamsPageState
    onStateChange: (updater: (prev: TeamsPageState) => TeamsPageState) => void
    caches: TeamsPageCaches
    onCachesChange: (updater: (prev: TeamsPageCaches) => TeamsPageCaches) => void
    onTeamSelect: (teamId: string) => void
}

export function TeamsPage({ userProfile, state, onStateChange, caches, onCachesChange, onTeamSelect }: TeamsPageProps) {
    const accessToken = userProfile?.accessToken

    const [loading, setLoading] = useState(!caches.loaded)
    const [error, setError] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const cachesRef = useRef(caches)
    cachesRef.current = caches

    const load = useCallback(async (background = false) => {
        if (!accessToken) return
        if (!background) setLoading(true)
        setError(null)
        try {
            const [team, invitations] = await Promise.all([
                fetchMyTeam(accessToken),
                fetchMyInvitations(accessToken),
            ])
            onCachesChange(prev => ({
                ...prev,
                myTeam: team,
                invitations,
                loaded: true,
                lastRefreshIso: new Date().toISOString(),
            }))
        } catch (e) {
            if (!background) setError(teamErrorMessage(e))
        } finally {
            if (!background) setLoading(false)
        }
    }, [accessToken, onCachesChange])

    useEffect(() => {
        if (accessToken) void load(cachesRef.current.loaded)
    }, [accessToken, load])

    useEffect(() => {
        if (scrollRef.current && !loading) scrollRef.current.scrollTop = state.scrollTop
    }, [loading, state.scrollTop])

    useRegisterPageRefresh({
        onRefresh: () => void load(),
        refreshing: loading,
        tooltip: 'Refresh',
    })

    const onCreated = useCallback((team: TeamDetail) => {
        onCachesChange(prev => ({ ...prev, myTeam: team }))
        refreshUserProfile()
        onTeamSelect(team.id)
    }, [onCachesChange, onTeamSelect])

    const onAccepted = useCallback((team: TeamDetail) => {
        onCachesChange(prev => ({ ...prev, myTeam: team }))
        refreshUserProfile()
        onTeamSelect(team.id)
    }, [onCachesChange, onTeamSelect])

    const setDirectorySearch = useCallback((value: string) => {
        onStateChange(prev => ({ ...prev, directorySearch: value }))
    }, [onStateChange])

    const setDirectoryPage = useCallback((page: number) => {
        onStateChange(prev => ({ ...prev, directoryPage: page }))
    }, [onStateChange])

    if (!accessToken) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sign in to manage your team.
            </div>
        )
    }

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">
            <div className="flex items-end justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">Teams</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Browse every team, manage your own, and build named lineups.
                    </p>
                </div>
                {caches.loaded && !caches.myTeam && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="size-4" /> Create Team
                    </Button>
                )}
            </div>

            {error && <div className="shrink-0"><ErrorBanner message={error} /></div>}

            <div
                ref={scrollRef}
                onScroll={() => {
                    if (scrollRef.current) {
                        const top = scrollRef.current.scrollTop
                        onStateChange(prev => (prev.scrollTop === top ? prev : { ...prev, scrollTop: top }))
                    }
                }}
                className="flex-1 min-h-0 overflow-auto px-0.5 pb-2 space-y-4"
            >
                {loading && !caches.loaded ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading teams…</div>
                ) : (
                    <>
                        <InvitationsSection
                            accessToken={accessToken}
                            invitations={caches.invitations}
                            hasActiveTeam={!!caches.myTeam}
                            onAccepted={onAccepted}
                            onSelect={onTeamSelect}
                        />

                        <TeamGallery
                            accessToken={accessToken}
                            myTeam={caches.myTeam}
                            search={state.directorySearch}
                            page={state.directoryPage}
                            onSearchChange={setDirectorySearch}
                            onPageChange={setDirectoryPage}
                            onSelect={onTeamSelect}
                        />
                    </>
                )}
            </div>

            <Modal
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Create a Team"
                offsetSidebar
                maxWidth="40rem"
                footer={null}
            >
                <CreateTeamForm
                    accessToken={accessToken}
                    userProfile={userProfile}
                    onCreated={team => { setCreateOpen(false); onCreated(team) }}
                    onCancel={() => setCreateOpen(false)}
                />
            </Modal>
        </div>
    )
}
