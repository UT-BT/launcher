import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import type { StreamSceneProps } from '../streamSceneOptions'
import type { StreamMatch } from '../data/streamHotState'
import { useSceneMatch, useSceneRead } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { seriesScoreOf } from './brb/brbView'
import { SeriesScoreCard } from './brb/SeriesScoreCard'
import { nextMapReadPath, type NextMapRead } from './nextMap/nextMapRead'
import { nextMapReadOrdinal, nextMapView, type NextMapShown, type NextMapView } from './nextMap/nextMapView'
import { NextMapHero } from './nextMap/NextMapHero'
import { NextMapColumn } from './nextMap/NextMapColumn'

function MapLayout({ next, match, onVideoFailed }: { next: NextMapShown; match: StreamMatch; onVideoFailed: (src: string) => void }) {
    return (
        <div data-next-map-state="map" data-next-map={next.number} className="grid h-full grid-cols-[1280px_minmax(0,1fr)] gap-x-10">
            <div className="flex min-w-0 flex-col">
                <NextMapHero next={next} onVideoFailed={onVideoFailed} />
                <div className="mt-auto flex min-w-0 items-end justify-between gap-8">
                    <p data-next-map-name className="min-w-0 truncate text-[68px] font-black italic uppercase leading-[0.9]">{next.title}</p>
                    <div className="shrink-0 pb-1 text-right">
                        {next.mapper && <p className="text-[26px] font-bold uppercase leading-none tracking-[0.1em] text-white/70">by {next.mapper}</p>}
                        {next.pick && (
                            <p data-next-map-pick className={cn('mt-2 text-[26px] font-black italic uppercase leading-none', PICK_BAN_TONES[next.tone].text)}>{next.pick}</p>
                        )}
                    </div>
                </div>
            </div>
            <NextMapColumn next={next} scoreCard={<SeriesScoreCard score={seriesScoreOf(match)} />} />
        </div>
    )
}

function MessageLayout({ state, headline, match }: { state: NextMapView['state']; headline: string; match: StreamMatch }) {
    return (
        <div data-next-map-state={state} className="flex h-full flex-col items-center justify-center gap-14">
            <p className="text-center text-[112px] font-black italic uppercase leading-none [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]">{headline}</p>
            <SeriesScoreCard score={seriesScoreOf(match)} large className="w-[760px]" />
        </div>
    )
}

function NextMapBody({ match, eventSlug, animate }: { match: StreamMatch; eventSlug: string; animate: boolean }) {
    const ordinal = nextMapReadOrdinal(match)
    const read = useSceneRead<NextMapRead>(ordinal === null ? null : nextMapReadPath(eventSlug, match.id, ordinal))
    const [failedVideo, setFailedVideo] = useState<string | null>(null)
    const readFailed = read.data === null && read.error != null
    const view = useMemo(
        () => nextMapView({ match, read: read.data, readFailed, failedVideo, animate }),
        [match, read.data, readFailed, failedVideo, animate],
    )

    return (
        <SceneFrame scene="next-map" title="Next Map" kicker={view.kicker}>
            {view.state === 'map' && <MapLayout next={view.next} match={match} onVideoFailed={setFailedVideo} />}
            {view.state === 'tbd' && <MessageLayout state="tbd" headline="Maps to be decided" match={match} />}
            {(view.state === 'over' || view.state === 'stalled') && <MessageLayout state={view.state} headline={view.headline} match={match} />}
        </SceneFrame>
    )
}

export default function NextMapScene({ eventSlug, options }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="next-map" />
    if (phase === 'idle') return <IdleFrame scene="next-map" />
    return <NextMapBody key={match.id} match={match} eventSlug={eventSlug} animate={options.animate} />
}
