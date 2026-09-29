import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import type { StreamMatch } from '../../data/streamHotState'
import { useSceneNow, useSceneRead } from '../../data/useStreamData'
import { SceneFrame } from '../../frame/SceneFrame'
import { streamFeedPath } from '../../ticker/streamFeed'
import { SoonAlsoToday, SoonCountdown, SoonOdds } from './SoonPanels'
import { SoonTeamPlate } from './SoonTeamPlate'
import { bettingReadPath, type StartingSoonBetting, type StartingSoonFeed } from './startingSoonReads'
import { startingSoonView } from './startingSoonView'
import { useCountdownCue } from './useCountdownCue'

interface StartingSoonBoardProps {
    eventSlug: string
    streamerId: string
    match: StreamMatch
    sound: StreamSound
}

export function StartingSoonBoard({ eventSlug, streamerId, match, sound }: StartingSoonBoardProps) {
    const betting = useSceneRead<StartingSoonBetting>(bettingReadPath(eventSlug, match.id))
    const feed = useSceneRead<StartingSoonFeed>(streamFeedPath(eventSlug, streamerId))
    const now = useSceneNow()
    const view = useMemo(() => startingSoonView({ match, betting: betting.data, feed: feed.data, now }), [match, betting.data, feed.data, now])
    const [teamA, teamB] = view.teams
    useCountdownCue(match, now, sound)

    return (
        <SceneFrame scene="starting-soon" title="Starting soon" kicker={view.kicker}>
            <div className="grid h-full" style={{ gridTemplateColumns: '1072px 1fr', columnGap: 48, lineHeight: 1.2 }}>
                <div className={cn('flex min-w-0 flex-col', !view.odds && 'justify-center')}>
                    <SoonTeamPlate team={teamA} />
                    <div className="flex shrink-0 items-center" style={{ height: 84, gap: 28, paddingLeft: 44 }}>
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="font-black italic text-white/90" style={{ fontSize: 60 }}>
                            VS
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                    </div>
                    <SoonTeamPlate team={teamB} />
                    {view.odds && <SoonOdds odds={view.odds} />}
                </div>
                <div className="flex min-h-0 min-w-0 flex-col" style={{ gap: 24 }}>
                    <SoonCountdown countdown={view.countdown} stage={view.stage} format={view.format} />
                    <SoonAlsoToday rows={view.alsoToday} />
                </div>
            </div>
        </SceneFrame>
    )
}
