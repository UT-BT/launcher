import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint, type PickBanTone } from '@/app/components/broadcast/broadcastTone'
import type { StreamSide } from '../../data/streamHotState'
import { sideToneClasses } from '../../sceneHelpers'
import type { PostMatchMapView } from './postMatchView'

const SIDES: readonly StreamSide[] = ['a', 'b']

interface SeriesTableProps {
    teams: Record<StreamSide, string>
    series: { a: number; b: number }
    maps: PostMatchMapView[]
    tileSize: number
    live?: boolean
}

function SeriesMapTile({ map, size }: { map: PostMatchMapView; size: number }) {
    const toneKey: PickBanTone = map.pickedBy ?? (map.map ? 'gold' : 'neutral')
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]

    return (
        <div className="@container/tile relative shrink-0" style={{ width: size, height: size }}>
            <div
                className="absolute inset-0 overflow-hidden rounded-[6cqw] bg-white/5"
                style={{ boxShadow: map.map ? `0 0 0 3px ${hue}, 0 0 28px ${tint(hue, 40)}, 0 10px 28px rgba(0,0,0,0.5)` : '0 10px 28px rgba(0,0,0,0.5)' }}
            >
                {map.map && <MapThumbnail mapName={map.map} size="card" alt="" priority className="absolute inset-0 size-full rounded-none border-0" />}
                <div className="pointer-events-none absolute inset-0 rounded-[6cqw] ring-1 ring-inset ring-white/10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
                <span
                    className={cn(
                        'absolute left-[5cqw] top-[5cqw] rounded-[3cqw] px-[4cqw] py-[1.5cqw] text-[clamp(11px,9cqw,28px)] font-black italic uppercase leading-none shadow-lg',
                        tone.solid,
                        tone.onSolid,
                    )}
                >
                    Map {map.number}
                </span>
                <p className="absolute inset-x-0 bottom-0 truncate px-[6cqw] pb-[5cqw] text-[clamp(11px,9cqw,28px)] font-bold uppercase leading-none tracking-wide text-white">
                    {map.map ? displayMapName(map.map) : 'To be picked'}
                </p>
            </div>
        </div>
    )
}

function capsTone(map: PostMatchMapView, won: boolean, side: StreamSide): string {
    if (won) return cn(sideToneClasses(side).solid, 'text-white')
    if (map.drawn) return 'bg-white/14 text-white/85'
    return 'bg-white/6 text-white/55'
}

function CapsCell({ map, side }: { map: PostMatchMapView; side: StreamSide }) {
    const won = map.winner === side
    const caps = map.state === 'upcoming' ? null : map.caps[side]
    return (
        <div
            className={cn(
                'flex h-[72px] items-center justify-center rounded-xl text-5xl font-black italic leading-[0.9] tabular-nums',
                capsTone(map, won, side),
            )}
        >
            {caps ?? '–'}
        </div>
    )
}

function mapNote(map: PostMatchMapView): string {
    if (map.drawn) return 'Drawn'
    if (map.state === 'live') return 'Live'
    if (map.state === 'upcoming') return 'Up next'
    return ''
}

export function SeriesTable({ teams, series, maps, tileSize, live = false }: SeriesTableProps) {
    const notes = live || maps.some(map => map.drawn)
    return (
        <div className="flex items-start gap-1.5">
            <div className="flex w-[250px] shrink-0 flex-col gap-3 py-2.5">
                <div style={{ height: tileSize }} />
                {SIDES.map(side => (
                    <div key={side} className="flex h-[72px] items-center gap-3.5">
                        <span className={cn('line-clamp-2 text-[40px] font-black italic uppercase leading-[0.95]', sideToneClasses(side).text)}>{teams[side]}</span>
                    </div>
                ))}
            </div>
            {maps.map(map => (
                <div
                    key={map.ordinal}
                    data-series-map={map.number}
                    className={cn('flex flex-col gap-3 p-2.5', map.state === 'live' && 'rounded-[18px] shadow-[0_0_0_2px_rgba(255,255,255,0.35)]')}
                >
                    <SeriesMapTile map={map} size={tileSize} />
                    {SIDES.map(side => <CapsCell key={side} map={map} side={side} />)}
                    {notes && (
                        <p data-series-map-note className="h-5 text-center text-base font-bold uppercase tracking-[0.16em] text-white/50">{mapNote(map)}</p>
                    )}
                </div>
            ))}
            <div className="flex w-[130px] shrink-0 flex-col gap-3 py-2.5 pl-[18px]">
                <div className="flex items-end justify-center" style={{ height: tileSize }}>
                    <p className="text-base font-bold uppercase tracking-[0.2em] text-white/60">Series</p>
                </div>
                {SIDES.map(side => (
                    <div key={side} className={cn('flex h-[72px] items-center justify-center text-[72px] font-black italic leading-[0.9] tabular-nums', sideToneClasses(side).text)}>
                        {series[side]}
                    </div>
                ))}
            </div>
        </div>
    )
}
