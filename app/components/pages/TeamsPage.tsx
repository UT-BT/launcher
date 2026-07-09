import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import {
    fetchMyApplications, fetchMyInvitations, fetchMyTeam,
    type TeamCore, type TeamDetail, type UserProfile,
} from '@/app/utils/api'
import { CreateTeamForm } from './teams/CreateTeamForm'
import { TeamDirectory } from './teams/TeamDirectory'
import { SelfMemberships } from './teams/SelfMemberships'
import { MyTeamView } from './teams/MyTeamView'
import { ErrorBanner, teamErrorMessage } from './teams/teamsShared'

export interface TeamsPageState {
    directorySearch: string
    directoryOpenOnly: boolean
    directoryPage: number
    scrollTop: number
}

export interface TeamsPageCaches {
    myTeam: TeamDetail | null
    invitations: TeamCore[]
    applications: TeamCore[]
    loaded: boolean
    lastRefreshIso: string | null
}

export const DEFAULT_TEAMS_STATE: TeamsPageState = {
    directorySearch: '',
    directoryOpenOnly: false,
    directoryPage: 1,
    scrollTop: 0,
}

export const DEFAULT_TEAMS_CACHES: TeamsPageCaches = {
    myTeam: null,
    invitations: [],
    applications: [],
    loaded: false,
    lastRefreshIso: null,
}

interface TeamsPageProps {
    userProfile?: UserProfile
    state: TeamsPageState
    onStateChange: (updater: (prev: TeamsPageState) => TeamsPageState) => void
    caches: TeamsPageCaches
    onCachesChange: (updater: (prev: TeamsPageCaches) => TeamsPageCaches) => void
}

export function TeamsPage({ userProfile, state, onStateChange, caches, onCachesChange }: TeamsPageProps) {
    const accessToken = userProfile?.accessToken
    const myUserId = userProfile?.id ?? undefined

    const [loading, setLoading] = useState(!caches.loaded)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const cachesRef = useRef(caches)
    cachesRef.current = caches

    const load = useCallback(async (background = false) => {
        if (!accessToken) return
        if (!background) setLoading(true)
        setError(null)
        try {
            const [team, invitations, applications] = await Promise.all([
                fetchMyTeam(accessToken),
                fetchMyInvitations(accessToken),
                fetchMyApplications(accessToken),
            ])
            onCachesChange(prev => ({
                ...prev,
                myTeam: team,
                invitations,
                applications,
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

    const setMyTeam = useCallback((team: TeamDetail | null) => {
        onCachesChange(prev => ({ ...prev, myTeam: team }))
    }, [onCachesChange])

    const setDirectorySearch = useCallback((value: string) => {
        onStateChange(prev => ({ ...prev, directorySearch: value }))
    }, [onStateChange])

    const setDirectoryOpenOnly = useCallback((value: boolean) => {
        onStateChange(prev => ({ ...prev, directoryOpenOnly: value }))
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
            <div className="shrink-0">
                <h1 className="text-2xl font-bold text-white leading-tight">Teams</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Form a clan, recruit members, and manage named lineups.
                </p>
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
                className="flex-1 min-h-0 overflow-auto px-0.5 pb-2"
            >
                {loading && !caches.loaded ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading your team…</div>
                ) : caches.myTeam ? (
                    <MyTeamView
                        accessToken={accessToken}
                        team={caches.myTeam}
                        myUserId={myUserId}
                        userProfile={userProfile}
                        onTeamChange={setMyTeam}
                        onLeftOrDisbanded={() => void load()}
                    />
                ) : (
                    <div className="space-y-4">
                        <SelfMemberships
                            accessToken={accessToken}
                            invitations={caches.invitations}
                            applications={caches.applications}
                            onAccepted={setMyTeam}
                        />
                        <CreateTeamForm
                            accessToken={accessToken}
                            userProfile={userProfile}
                            onCreated={setMyTeam}
                        />
                        <TeamDirectory
                            accessToken={accessToken}
                            search={state.directorySearch}
                            openOnly={state.directoryOpenOnly}
                            page={state.directoryPage}
                            onSearchChange={setDirectorySearch}
                            onOpenOnlyChange={setDirectoryOpenOnly}
                            onPageChange={setDirectoryPage}
                            onApplied={() => void load(true)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
