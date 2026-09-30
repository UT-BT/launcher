import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint } from '@/app/components/broadcast/broadcastTone'
import { EASE_OUT, REVEAL_POP } from '@/app/components/broadcast/broadcastMotion'
import type { StreamSide, StreamTeam } from '../../data/streamHotState'
import { sideToneClasses } from '../../sceneHelpers'
import { mapToneOf, type SeriesMapView, type SeriesScore } from './intermissionView'
import { SceneMapTile } from './SceneMapTile'
import { revealDelayS, type MapReveal } from './useMapReveal'

const SIDES: StreamSide[] = ['a', 'b']
const NAME_WIDTH = 230
const SERIES_WIDTH = 120
const COLUMN_GAP = 6
const COLUMN_PADDING = 20

const LAYOUTS = {
    full: { width: 1750, maxTile: 220 },
    beside: { width: 1020, maxTile: 150 },
}

export type SeriesTableLayout = keyof typeof LAYOUTS

const GOLD = PICK_BAN_HUES.gold

function tileSizeFor(count: number, layout: SeriesTableLayout): number {
    const { width, maxTile } = LAYOUTS[layout]
    const column = (width - NAME_WIDTH - SERIES_WIDTH - COLUMN_GAP * (count + 1)) / Math.max(count, 1)
    return Math.min(maxTile, Math.floor(column - COLUMN_PADDING))
}

function columnGlow(map: SeriesMapView): string | undefined {
    if (map.latest) return `0 0 0 3px ${GOLD}, 0 0 46px ${tint(GOLD, 55)}`
    if (map.status === 'next') return '0 0 0 2px rgba(255,255,255,0.35)'
    return undefined
}

function statusLabel(map: SeriesMapView): string | null {
    if (map.latest) return 'Just decided'
    if (map.status === 'next') return 'Up next'
    return null
}

function CapCell({ map, side, reveal }: { map: SeriesMapView; side: StreamSide; reveal: MapReveal }) {
    const caps = map.caps?.[side] ?? null
    const won = map.winner === side
    const tone = sideToneClasses(side)
    const popping = won && reveal?.ordinals.includes(map.ordinal)

    return (
        <motion.div
            key={popping ? `pop-${reveal?.seq}` : 'still'}
            animate={popping ? { ...REVEAL_POP, transition: { ...REVEAL_POP.transition, delay: revealDelayS(reveal, map.ordinal) } } : undefined}
            className={cn(
                'flex h-[72px] items-center justify-center rounded-xl text-5xl font-black italic leading-[0.9] tabular-nums',
                won ? cn(tone.solid, tone.onSolid) : 'bg-white/[0.06] text-white/55',
            )}
        >
            {caps ?? '–'}
        </motion.div>
    )
}

function MapColumn({ map, size, reveal, fill }: { map: SeriesMapView; size: number; reveal: MapReveal; fill: boolean }) {
    const revealing = reveal?.ordinals.includes(map.ordinal) ?? false
    const label = statusLabel(map)

    return (
        <div
            data-map-column={map.number}
            data-map-status={map.status}
            data-map-revealing={revealing ? reveal?.seq : undefined}
            className={cn('relative flex flex-col gap-3 rounded-[18px] p-2.5', fill ? 'min-w-0 flex-1' : 'shrink-0')}
            style={{ boxShadow: columnGlow(map) }}
        >
            {revealing && (
                <motion.span
                    key={`ring-${reveal?.seq}`}
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.9, 1, 1.18] }}
                    transition={{ duration: 1.2, ease: EASE_OUT, delay: revealDelayS(reveal, map.ordinal) - 0.1 }}
                    className="pointer-events-none absolute inset-0 rounded-[18px]"
                    style={{ boxShadow: `0 0 0 4px ${GOLD}, 0 0 80px ${tint(GOLD, 70)}` }}
                />
            )}
            <div className="flex justify-center">
                <SceneMapTile map={map.map} number={map.number} tone={mapToneOf(map.pickedBy, map.decider)} decider={map.decider} size={size} />
            </div>
            {SIDES.map(side => <CapCell key={side} map={map} side={side} reveal={reveal} />)}
            <div className="flex h-11 flex-col items-center justify-start gap-1 text-center font-bold uppercase leading-none">
                <p className={cn('h-4 text-base tracking-[0.16em]', map.latest ? PICK_BAN_TONES.gold.text : 'text-white/50')}>{label}</p>
                {map.sourceLabel && <p data-caps-source className="text-[13px] tracking-[0.14em] text-white/40">{map.sourceLabel}</p>}
            </div>
        </div>
    )
}

export function SeriesTable({ maps, series, teams, reveal, layout }: {
    maps: SeriesMapView[]
    series: SeriesScore
    teams: Record<StreamSide, StreamTeam | null>
    reveal: MapReveal
    layout: SeriesTableLayout
}) {
    const size = tileSizeFor(maps.length, layout)

    return (
        <div className="flex items-start" style={{ gap: COLUMN_GAP }}>
            <div className="flex shrink-0 flex-col gap-3 py-2.5" style={{ width: NAME_WIDTH }}>
                <div style={{ height: size }} />
                {SIDES.map(side => {
                    const tone = sideToneClasses(side)
                    return (
                        <div key={side} className="flex h-[72px] items-center">
                            <span className={cn('line-clamp-2 text-[40px] font-black italic uppercase leading-[0.95]', tone.text)}>{teams[side]?.name ?? 'TBD'}</span>
                        </div>
                    )
                })}
            </div>
            {maps.map(map => <MapColumn key={map.ordinal} map={map} size={size} reveal={reveal} fill={layout === 'full'} />)}
            <div className="flex shrink-0 flex-col gap-3 py-2.5 pl-[18px]" style={{ width: SERIES_WIDTH }}>
                <div className="flex items-end justify-center" style={{ height: size }}>
                    <p className="text-base font-bold uppercase tracking-[0.2em] text-white/60">Series</p>
                </div>
                {SIDES.map(side => (
                    <p key={side} data-series-side={side} className={cn('flex h-[72px] items-center justify-center text-7xl font-black italic leading-[0.9] tabular-nums', sideToneClasses(side).text)}>
                        {series[side]}
                    </p>
                ))}
            </div>
        </div>
    )
}
