import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventAdminTeams,
    type EventBracket, type EventDetail, type EventGroupsConfig, type EventLfpEntry, type EventTeam,
} from '@/app/utils/api'
import { EventRosterProvider } from './TeamRoster'
import { SignupsPanel } from './manage/SignupsPanel'
import { FormatPanel } from './manage/FormatPanel'
import { SeedingPanel } from './manage/SeedingPanel'
import { BracketPanel } from './manage/BracketPanel'

type ManageTab = 'signups' | 'format' | 'bracket'

const TABS: { id: ManageTab; label: string }[] = [
    { id: 'signups', label: 'Signups' },
    { id: 'format', label: 'Format' },
    { id: 'bracket', label: 'Bracket' },
]

interface ManagePanelProps {
    accessToken: string
    slug: string
    event: EventDetail
    lfp: EventLfpEntry[]
    bracket: EventBracket | null
    canManageEvent: boolean
    onBracketChange: (bracket: EventBracket) => void
    onMapSelect?: (mapName: string) => void
    onRefresh: () => void
}

export function ManagePanel({
    accessToken, slug, event, lfp, bracket, canManageEvent, onBracketChange, onMapSelect, onRefresh,
}: ManagePanelProps) {
    const tabs = canManageEvent ? TABS : TABS.filter(entry => entry.id !== 'signups')
    const [storedTab, setTab] = useNavState<ManageTab>('event.manageTab', canManageEvent ? 'signups' : 'format')
    const tab = tabs.some(entry => entry.id === storedTab) ? storedTab : tabs[0].id
    const [teams, setTeams] = useState<EventTeam[]>([])
    const [teamsError, setTeamsError] = useState<string | null>(null)
    // The Format tab keeps its edits in component state, so switching tabs
    // unmounts them. Ask first rather than dropping the work silently.
    const [formatDirty, setFormatDirty] = useState(false)
    const [pendingTab, setPendingTab] = useState<ManageTab | null>(null)

    const chooseTab = useCallback((next: ManageTab) => {
        if (next !== 'format' && formatDirty) {
            setPendingTab(next)
            return
        }
        setTab(next)
    }, [formatDirty, setTab])

    const reloadTeams = useCallback(async () => {
        try {
            setTeams(await fetchEventAdminTeams(accessToken, slug))
            setTeamsError(null)
        } catch (e) {
            setTeamsError(eventErrorMessage(e))
        }
    }, [accessToken, slug])

    useEffect(() => { void reloadTeams() }, [reloadTeams])

    const hasDrawnStages = (bracket?.stages ?? []).some(stage => stage.matches.length > 0)

    const tierSize = useMemo(() => {
        const groupsStage = bracket?.format.spec?.stages.find(stage => stage.kind === 'groups')
        const count = (groupsStage?.config as EventGroupsConfig | undefined)?.group_count
        return count && count > 0 ? count : null
    }, [bracket])

    return (
        <EventRosterProvider teams={teams}>
        <div className="space-y-4">
            <ErrorBanner message={teamsError} />

            <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
                {tabs.map(entry => (
                    <button
                        key={entry.id}
                        onClick={() => chooseTab(entry.id)}
                        className={cn(
                            'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer',
                            tab === entry.id
                                ? 'border-accent-400 text-white'
                                : 'border-transparent text-muted-foreground hover:text-white',
                        )}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            {tab === 'signups' && (
                <SignupsPanel
                    accessToken={accessToken}
                    slug={slug}
                    event={event}
                    lfp={lfp}
                    teams={teams}
                    onReloadTeams={reloadTeams}
                    onRefresh={onRefresh}
                />
            )}

            {tab === 'format' && (
                // The seeding list is narrow and the builder is not, so on a wide
                // screen they sit side by side instead of stacking.
                <div className="grid gap-4 items-start 2xl:grid-cols-[26rem_minmax(0,1fr)]">
                    <SeedingPanel
                        accessToken={accessToken}
                        slug={slug}
                        teams={teams}
                        tierSize={tierSize}
                        onSaved={() => { void reloadTeams(); onRefresh() }}
                    />
                    <FormatPanel
                        accessToken={accessToken}
                        slug={slug}
                        bracket={bracket}
                        hasDrawnStages={hasDrawnStages}
                        onBracketChange={onBracketChange}
                        onDirtyChange={setFormatDirty}
                    />
                </div>
            )}

            {tab === 'bracket' && (
                <BracketPanel
                    accessToken={accessToken}
                    slug={slug}
                    bracket={bracket}
                    onBracketChange={onBracketChange}
                    onMapSelect={onMapSelect}
                />
            )}

            <ConfirmModal
                isOpen={!!pendingTab}
                onClose={() => setPendingTab(null)}
                onConfirm={() => {
                    const target = pendingTab
                    setPendingTab(null)
                    setFormatDirty(false)
                    if (target) setTab(target)
                }}
                title="Leave without saving?"
                message="The tournament format has edits you have not saved yet."
                detail="Anything you have not saved is lost."
                confirmText="Leave"
                variant="error"
            />
        </div>
        </EventRosterProvider>
    )
}
