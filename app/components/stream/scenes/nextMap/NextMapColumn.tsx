import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint } from '@/app/components/broadcast/broadcastTone'
import { toActiveTitle } from '@/app/utils/api'
import { formatCapTime } from '@/app/utils/format'
import type { NextMapHistoryView, NextMapPerson, NextMapPlayerView, NextMapShown, NextMapWrView } from './nextMapView'

const MUTED = 'font-bold uppercase text-white/45'
const LABEL = 'text-[15px] font-bold uppercase tracking-[0.2em] text-white/55'
const MAX_WR_ROSTERS = 2

function Panel({ label, name, children }: { label: string; name: string; children: ReactNode }) {
    return (
        <section data-next-map-panel={name} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-2xl">
            <p className={LABEL}>{label}</p>
            {children}
        </section>
    )
}

function Empty({ loaded, children }: { loaded: boolean; children: ReactNode }) {
    return <p className={cn(MUTED, 'mt-2 min-h-[26px] text-xl tracking-[0.12em]')}>{loaded ? children : ''}</p>
}

function People({ people }: { people: NextMapPerson[] }) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-sans [zoom:1.15]">
            {people.map((person, index) => (
                <PlayerInfo key={person.id ?? index} userId={person.id ?? undefined} alias={person.name} size="sm" interactive={false} />
            ))}
        </div>
    )
}

function WrPanel({ wr, loaded }: { wr: NextMapWrView | null; loaded: boolean }) {
    const shown = wr?.holders.slice(0, MAX_WR_ROSTERS) ?? []
    const more = (wr?.holders.length ?? 0) - shown.length

    return (
        <Panel label="Team WR" name="wr">
            {wr ? (
                <>
                    <p className="mt-1 text-[46px] font-black italic leading-none tabular-nums">{formatCapTime(wr.seconds)}</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                        {shown.map((roster, index) => <People key={index} people={roster} />)}
                        {more > 0 && <p className={cn(MUTED, 'text-base tracking-[0.14em]')}>+{more} more tied</p>}
                    </div>
                </>
            ) : (
                <Empty loaded={loaded}>No time yet</Empty>
            )}
        </Panel>
    )
}

function PbRow({ player, loaded }: { player: NextMapPlayerView; loaded: boolean }) {
    const hue = PICK_BAN_HUES[player.side]

    return (
        <li
            data-pb-slot={player.slot}
            className="flex h-[50px] items-center gap-3 rounded-lg pr-3"
            style={{ background: `linear-gradient(to right, ${tint(hue, 16)}, transparent)` }}
        >
            <span className="h-full w-1.5 shrink-0 rounded-l-lg" style={{ background: hue }} />
            <div className="min-w-0 flex-1 font-sans [zoom:1.15]">
                <PlayerInfo userId={player.id ?? undefined} alias={player.name} title={toActiveTitle(player.title)} size="sm" interactive={false} />
            </div>
            {player.pb ? (
                <span className="flex shrink-0 flex-col items-end">
                    <span className="text-[26px] font-black italic leading-none tabular-nums">{formatCapTime(player.pb.seconds)}</span>
                    <span className="mt-0.5 flex gap-2 text-[15px] font-bold leading-none tracking-[0.1em]">
                        {!player.pb.verified && <span className="uppercase text-white/45">Pending</span>}
                        {player.gap && <span data-pb-gap className={cn(player.gap === 'WR' ? PICK_BAN_TONES.gold.text : 'text-white/70')}>{player.gap}</span>}
                    </span>
                </span>
            ) : (
                loaded && <span className={cn(MUTED, 'shrink-0 text-lg tracking-[0.12em]')}>No time yet</span>
            )}
        </li>
    )
}

function PbPanel({ players, loaded }: { players: NextMapPlayerView[]; loaded: boolean }) {
    return (
        <Panel label="Lineup PBs" name="pbs">
            <ul className="mt-2.5 flex flex-col gap-1.5">
                {players.map(player => <PbRow key={player.slot} player={player} loaded={loaded} />)}
            </ul>
        </Panel>
    )
}

function HistoryPanel({ history, loaded }: { history: NextMapHistoryView | null; loaded: boolean }) {
    const fastest = history?.fastest ?? null

    return (
        <Panel label="Cup history" name="history">
            {history ? (
                <>
                    <p className="mt-1.5 text-2xl font-black italic uppercase leading-none">{history.played}</p>
                    {fastest ? (
                        <div className="mt-3">
                            <p className={LABEL}>Fastest cup team run</p>
                            <p className="mt-1 flex items-baseline gap-3">
                                <span className="text-[34px] font-black italic leading-none tabular-nums">{formatCapTime(fastest.seconds)}</span>
                                {!fastest.verified && <span className={cn(MUTED, 'text-[15px] tracking-[0.1em]')}>Pending</span>}
                                {fastest.team && <span className="min-w-0 truncate text-2xl font-black italic uppercase leading-none">{fastest.team}</span>}
                            </p>
                            <div className="mt-2">
                                <People people={fastest.players} />
                            </div>
                        </div>
                    ) : (
                        <p className={cn(MUTED, 'mt-2 text-lg tracking-[0.12em]')}>No cup team runs yet</p>
                    )}
                </>
            ) : (
                <Empty loaded={loaded}>No cup history</Empty>
            )}
        </Panel>
    )
}

export function NextMapColumn({ next, scoreCard }: { next: NextMapShown; scoreCard: ReactNode }) {
    return (
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
            {scoreCard}
            <WrPanel wr={next.wr} loaded={next.loaded} />
            <PbPanel players={next.players} loaded={next.loaded} />
            <HistoryPanel history={next.history} loaded={next.loaded} />
        </div>
    )
}
