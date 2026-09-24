import {
    Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useState,
    type Dispatch, type ReactNode, type SetStateAction,
} from 'react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventAdminTeams,
    type EventBracket, type EventDetail, type EventFormatSpec, type EventGroupsConfig,
    type EventLfpEntry, type EventTeam,
} from '@/app/utils/api'
import { EventRosterProvider } from './TeamRoster'
import { SignupsPanel } from './manage/SignupsPanel'
import { FormatPanel } from './manage/FormatPanel'
import { SeedingPanel } from './manage/SeedingPanel'
import { BracketPanel } from './manage/BracketPanel'
import { PredictionsManagePanel } from './manage/PredictionsManagePanel'
import { ScheduleOversightPanel } from './manage/ScheduleOversightPanel'
import { SchedulingWindowsPanel } from './manage/SchedulingWindowsPanel'
import type { PickBanDrafts } from './manage/pickban/pickBanEditor'

const PickBanPanel = lazy(() => import('./manage/pickban/PickBanPanel').then(m => ({ default: m.PickBanPanel })))

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
    formatDraft: EventFormatSpec | null
    onFormatDraftChange: Dispatch<SetStateAction<EventFormatSpec | null>>
    pickBanDrafts: PickBanDrafts
    onPickBanDraftsChange: Dispatch<SetStateAction<PickBanDrafts>>
}

type ManageTabContext = Omit<ManagePanelProps, 'canManageEvent'> & {
    teams: EventTeam[]
    reloadTeams: () => Promise<void>
    tierSize: number | null
    hasDrawnStages: boolean
}

interface ManageTab {
    id: string
    label: string
    eventManagersOnly?: boolean
    hasUnsavedChanges?: (context: ManageTabContext) => boolean
    render: (context: ManageTabContext) => ReactNode
}

const MANAGE_TABS: ManageTab[] = [
    {
        id: 'signups',
        label: 'Signups',
        eventManagersOnly: true,
        render: context => (
            <SignupsPanel
                accessToken={context.accessToken}
                slug={context.slug}
                event={context.event}
                lfp={context.lfp}
                teams={context.teams}
                onReloadTeams={context.reloadTeams}
                onRefresh={context.onRefresh}
            />
        ),
    },
    {
        id: 'format',
        label: 'Format',
        hasUnsavedChanges: context => context.formatDraft !== null,
        render: context => (
            <div className="grid gap-4 items-start 2xl:grid-cols-[26rem_minmax(0,1fr)]">
                <SeedingPanel
                    accessToken={context.accessToken}
                    slug={context.slug}
                    teams={context.teams}
                    tierSize={context.tierSize}
                    onSaved={() => { void context.reloadTeams(); context.onRefresh() }}
                />
                <FormatPanel
                    accessToken={context.accessToken}
                    slug={context.slug}
                    bracket={context.bracket}
                    hasDrawnStages={context.hasDrawnStages}
                    onBracketChange={context.onBracketChange}
                    draft={context.formatDraft}
                    onDraftChange={context.onFormatDraftChange}
                />
            </div>
        ),
    },
    {
        id: 'bracket',
        label: 'Bracket',
        render: context => (
            <BracketPanel
                accessToken={context.accessToken}
                slug={context.slug}
                bracket={context.bracket}
                onBracketChange={context.onBracketChange}
                onMapSelect={context.onMapSelect}
            />
        ),
    },
    {
        id: 'pickban',
        label: 'Pick/Ban',
        hasUnsavedChanges: context => Object.keys(context.pickBanDrafts).length > 0,
        render: context => (
            <Suspense fallback={<p className="text-xs text-muted-foreground">Loading the pick/ban setup…</p>}>
                <PickBanPanel
                    accessToken={context.accessToken}
                    slug={context.slug}
                    drafts={context.pickBanDrafts}
                    onDraftsChange={context.onPickBanDraftsChange}
                    onFormatDraftChange={context.onFormatDraftChange}
                    onBracketChange={context.onBracketChange}
                    onMapSelect={context.onMapSelect}
                />
            </Suspense>
        ),
    },
    {
        id: 'schedule',
        label: 'Schedule',
        render: context => (
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Windows</h3>
                    <SchedulingWindowsPanel accessToken={context.accessToken} slug={context.slug} />
                </div>
                <ScheduleOversightPanel accessToken={context.accessToken} slug={context.slug} />
            </div>
        ),
    },
    {
        id: 'predictions',
        label: 'Predictions',
        render: context => (
            <PredictionsManagePanel accessToken={context.accessToken} slug={context.slug} onRefresh={context.onRefresh} />
        ),
    },
]

export function ManagePanel({ canManageEvent, ...props }: ManagePanelProps) {
    const { accessToken, slug, bracket } = props
    const tabs = canManageEvent ? MANAGE_TABS : MANAGE_TABS.filter(entry => !entry.eventManagersOnly)
    const [storedTab, setTab] = useNavState<string>('event.manageTab', tabs[0].id)
    const activeTab = tabs.find(entry => entry.id === storedTab) ?? tabs[0]
    const [teams, setTeams] = useState<EventTeam[]>([])
    const [teamsError, setTeamsError] = useState<string | null>(null)

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

    const context: ManageTabContext = { ...props, teams, reloadTeams, tierSize, hasDrawnStages }

    return (
        <EventRosterProvider teams={teams}>
        <div className="space-y-4">
            <ErrorBanner message={teamsError} />

            <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
                {tabs.map(entry => (
                    <button
                        key={entry.id}
                        onClick={() => setTab(entry.id)}
                        className={cn(
                            'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer',
                            activeTab.id === entry.id
                                ? 'border-accent-400 text-white'
                                : 'border-transparent text-muted-foreground hover:text-white',
                        )}
                    >
                        {entry.label}
                        {entry.hasUnsavedChanges?.(context) && (
                            <span
                                aria-label="unsaved changes"
                                className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-300 align-middle"
                            />
                        )}
                    </button>
                ))}
            </div>

            <Fragment key={activeTab.id}>{activeTab.render(context)}</Fragment>

        </div>
        </EventRosterProvider>
    )
}
