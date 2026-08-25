import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
    fetchEventAdminTeams,
    type EventBracket, type EventDetail, type EventGroupsConfig, type EventLfpEntry, type EventTeam,
} from '@/app/utils/api'
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
    onBracketChange: (bracket: EventBracket) => void
    onMapSelect?: (mapName: string) => void
    onRefresh: () => void
}

export function ManagePanel({
    accessToken, slug, event, lfp, bracket, onBracketChange, onMapSelect, onRefresh,
}: ManagePanelProps) {
    const [tab, setTab] = useNavState<ManageTab>('event.manageTab', 'signups')
    const [teams, setTeams] = useState<EventTeam[]>([])

    const reloadTeams = useCallback(async () => {
        try {
            setTeams(await fetchEventAdminTeams(accessToken, slug))
        } catch {
            setTeams([])
        }
    }, [accessToken, slug])

    useEffect(() => { void reloadTeams() }, [reloadTeams])

    const hasDrawnStages = (bracket?.stages ?? []).some(stage => stage.matches.length > 0)

    // Tiers are as wide as the group count, so seeding can show which tier a seed lands in.
    const tierSize = useMemo(() => {
        const groupsStage = bracket?.format.spec?.stages.find(stage => stage.kind === 'groups')
        const count = (groupsStage?.config as EventGroupsConfig | undefined)?.group_count
        return count && count > 0 ? count : null
    }, [bracket])

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
                {TABS.map(entry => (
                    <button
                        key={entry.id}
                        onClick={() => setTab(entry.id)}
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
                <div className="max-w-3xl">
                    <SignupsPanel
                        accessToken={accessToken}
                        slug={slug}
                        event={event}
                        lfp={lfp}
                        teams={teams}
                        onReloadTeams={reloadTeams}
                        onRefresh={onRefresh}
                    />
                </div>
            )}

            {tab === 'format' && (
                <div className="max-w-4xl space-y-4">
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
        </div>
    )
}
