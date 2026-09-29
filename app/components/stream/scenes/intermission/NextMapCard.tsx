import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint } from '@/app/components/broadcast/broadcastTone'
import { displayMapName, formatCapTime } from '@/app/utils/format'
import { toActiveTitle } from '@/app/utils/api'
import type { StreamMatch } from '../../data/streamHotState'
import { mapToneOf, teamLabel, type IntermissionPlayerView, type NextMapView } from './intermissionView'
import { SceneMapTile } from './SceneMapTile'

const MUTED = 'font-bold uppercase text-white/45'

function Stat({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[15px] font-bold uppercase tracking-[0.16em] text-white/55">{label}</p>
            <div className="mt-1.5 min-h-[42px] truncate font-black italic leading-[0.9] tabular-nums">{children}</div>
        </div>
    )
}

function PbRow({ player, loaded }: { player: IntermissionPlayerView; loaded: boolean }) {
    const hue = PICK_BAN_HUES[player.side]

    return (
        <li
            data-pb-slot={player.slot}
            className="flex h-14 items-center gap-4 rounded-xl px-[18px]"
            style={{ background: `linear-gradient(to right, ${tint(hue, 16)}, transparent)` }}
        >
            <span className="h-[34px] w-1.5 shrink-0 rounded-sm" style={{ background: hue }} />
            <div className="min-w-0 flex-1 font-sans [zoom:1.4]">
                <PlayerInfo userId={player.id ?? undefined} alias={player.name} title={toActiveTitle(player.title)} size="md" interactive={false} />
            </div>
            {player.pb ? (
                <span className="flex shrink-0 items-baseline gap-3">
                    {!player.pb.verified && <span className={cn(MUTED, 'text-base tracking-[0.14em]')}>Pending</span>}
                    <span className="text-[38px] font-black italic leading-[0.9] tabular-nums">{formatCapTime(player.pb.seconds)}</span>
                </span>
            ) : (
                loaded && <span className={cn(MUTED, 'shrink-0 text-[22px] tracking-[0.12em]')}>No time yet</span>
            )}
        </li>
    )
}

export function NextMapCard({ match, next }: { match: StreamMatch; next: NextMapView }) {
    const tone = mapToneOf(next.pickedBy, next.decider)
    const picker = next.pickedBy ? teamLabel(match, next.pickedBy) : null
    const byline = picker ? `Picked by ${picker}` : next.decider ? 'Decider' : null

    return (
        <section
            data-next-map={next.number}
            className="flex min-w-0 flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.04] px-[30px] py-[26px] shadow-2xl"
        >
            <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">Next map</p>
            <div className="mt-4 flex items-start gap-7">
                <SceneMapTile map={next.map} number={next.number} tone={tone} decider={next.decider} size={280} version={next.screenshotVersion} image="hero" framed />
                <div className="min-w-0 flex-1 pt-1">
                    <p className="break-words text-[58px] font-black italic uppercase leading-[0.95]">{next.map ? displayMapName(next.map) : 'To be decided'}</p>
                    {byline && <p className={cn('mt-3 text-2xl font-bold uppercase tracking-[0.14em]', PICK_BAN_TONES[tone].text)}>{byline}</p>}
                    <div className="mt-[22px] grid gap-3.5">
                        <Stat label="Mapper">
                            <span className="text-4xl">{next.mapper ?? (next.loaded ? 'Unknown' : '')}</span>
                        </Stat>
                        <Stat label="Map WR">
                            {next.wrSeconds !== null
                                ? <span className="text-[46px]">{formatCapTime(next.wrSeconds)}</span>
                                : <span className={cn(MUTED, 'text-[22px] not-italic tracking-[0.12em]')}>{next.loaded ? 'No time yet' : ''}</span>}
                        </Stat>
                    </div>
                </div>
            </div>
            <p className="mb-3 mt-[26px] text-base font-bold uppercase tracking-[0.2em] text-white/60">Lineup PBs on this map</p>
            <ul className="flex flex-col gap-2">
                {next.players.map(player => <PbRow key={player.slot} player={player} loaded={next.loaded} />)}
            </ul>
        </section>
    )
}
