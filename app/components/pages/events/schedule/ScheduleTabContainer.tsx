import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Globe } from 'lucide-react'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useDisplayTimezone } from '@/app/utils/timezone'
import type { EventBracket } from '@/app/utils/api'
import { Segmented } from '@/app/components/shared/Segmented'
import { createPoller } from '@/app/utils/poller'
import { autoScheduleView, type ScheduleView } from '../eventsShared'
import { PublicSchedulePanel } from './PublicSchedulePanel'
import { ScheduleLoading } from './scheduleShared'

const BRACKET_REFRESH_MS = 60_000

export interface ScheduleTabContainerProps {
    participant: boolean
    myScheduleLoaded: boolean
    pickBanSessionOpen: boolean
    awaitingCount: number
    bracket: EventBracket | null
    bracketLoading: boolean
    eventSlug: string
    myTeamId: string | null
    onBracketRefresh: () => void
    myMatchesPanel: ReactNode
}

export function ScheduleTabContainer({
    participant, myScheduleLoaded, pickBanSessionOpen, awaitingCount, bracket, bracketLoading, eventSlug, myTeamId,
    onBracketRefresh, myMatchesPanel,
}: ScheduleTabContainerProps) {
    const timezone = useDisplayTimezone()
    const [chosenView, setChosenView] = useNavState<ScheduleView | null>('event.scheduleView', null)
    const [settledView, setSettledView] = useState<ScheduleView | null>(null)
    const autoView = autoScheduleView(awaitingCount, pickBanSessionOpen)

    if (participant && myScheduleLoaded && settledView === null) setSettledView(autoView)

    const view: ScheduleView | null = participant ? chosenView ?? settledView ?? (myScheduleLoaded ? autoView : null) : 'all'

    const onBracketRefreshRef = useRef(onBracketRefresh)
    onBracketRefreshRef.current = onBracketRefresh

    const bracketPoller = useMemo(() => createPoller({
        intervalMs: () => BRACKET_REFRESH_MS,
        pollOnStart: false,
        poll: async () => { onBracketRefreshRef.current() },
    }), [])

    useEffect(() => {
        if (view !== 'all') return
        bracketPoller.start()
        return () => bracketPoller.stop()
    }, [view, bracketPoller])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                {participant && (
                    <div role="group" aria-label="Schedule view" className="flex flex-wrap items-center gap-1">
                        <Segmented active={view === 'all'} label="All Matches" onClick={() => setChosenView('all')} />
                        <Segmented
                            active={view === 'mine'}
                            label={awaitingCount > 0 ? `My Matches (${awaitingCount})` : 'My Matches'}
                            onClick={() => setChosenView('mine')}
                        />
                    </div>
                )}
                <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Globe className="size-3.5 shrink-0" />
                    <span className="min-w-0 break-words">Times in {timezone}</span>
                </p>
            </div>

            {view === null ? (
                <ScheduleLoading />
            ) : view === 'mine' ? (
                myMatchesPanel
            ) : (
                <PublicSchedulePanel bracket={bracket} loading={bracketLoading} eventSlug={eventSlug} myTeamId={myTeamId} />
            )}
        </div>
    )
}
