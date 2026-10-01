import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { sideToneClasses } from '../../sceneHelpers'
import { BAND } from './overlayLayout'
import type { StreamSide } from '../../data/streamHotState'
import type { OverlayMapResult, OverlayStrip, OverlayStripMap } from './overlayView'

const NAME_CLASSES: Record<OverlayStripMap['state'], string> = {
    played: 'text-white/42',
    current: 'font-extrabold italic tracking-[0.03em] text-white',
    upcoming: 'text-white/50',
}

function badgeStyle(map: OverlayStripMap): CSSProperties {
    const hue = PICK_BAN_HUES[map.tone]
    if (map.state === 'upcoming') return { boxShadow: `inset 0 0 0 1.5px ${hue}`, color: hue }
    return { background: hue, opacity: map.state === 'played' ? 0.5 : 1 }
}

function Result({ result }: { result: OverlayMapResult }) {
    const score = (side: StreamSide) => <b className={cn('font-bold', result.winner === side && sideToneClasses(side).text)}>{result[side]}</b>

    return (
        <span data-map-result className="font-bold tabular-nums tracking-[0.02em] text-white/55">
            {score('a')}
            <i className="px-[0.12em] not-italic">–</i>
            {score('b')}
        </span>
    )
}

function MapCell({ map, divider }: { map: OverlayStripMap; divider: boolean }) {
    return (
        <div
            data-overlay-map={map.number}
            data-map-state={map.state}
            data-map-tone={map.tone}
            className={cn(
                'relative flex shrink-0 items-center gap-[0.45em] whitespace-nowrap px-[0.7em]',
                divider && 'before:absolute before:inset-y-[22%] before:left-0 before:w-px before:bg-white/12',
                map.state === 'current' && 'bg-linear-to-b from-white/16 to-white/7 shadow-[inset_0_-2px_0_rgba(255,255,255,0.9)]',
            )}
        >
            <span
                className={cn(
                    'inline-flex size-[1.2em] shrink-0 items-center justify-center rounded-[0.22em] pr-[0.06em] text-[0.86em] font-black italic leading-none',
                    map.state !== 'upcoming' && PICK_BAN_TONES[map.tone].onSolid,
                )}
                style={badgeStyle(map)}
            >
                {map.number}
            </span>
            {map.showName && (
                <span
                    className={cn('truncate font-bold uppercase tracking-[0.04em]', NAME_CLASSES[map.state])}
                    style={{ maxWidth: map.nameMaxPx ?? undefined }}
                >
                    {map.name}
                </span>
            )}
            {map.result && <Result result={map.result} />}
        </div>
    )
}

export function OverlayMapStrip({ strip }: { strip: OverlayStrip }) {
    if (strip.maps.length === 0 && strip.target === null) return null

    return (
        <div
            data-overlay-strip
            data-compact={strip.compact}
            className="relative z-10 flex items-stretch rounded-lg bg-[#05070c] text-base leading-none shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
            style={{ height: BAND.height, maxWidth: BAND.maxWidth, paddingInline: BAND.paddingX }}
        >
            <div className="flex min-w-0 items-stretch overflow-hidden">
                {strip.maps.map((map, index) => (
                    <MapCell
                        key={map.ordinal}
                        map={map}
                        divider={index > 0 && map.state !== 'current' && strip.maps[index - 1].state !== 'current'}
                    />
                ))}
            </div>
            {strip.target && (
                <span
                    data-overlay-target
                    className="ml-1.5 shrink-0 self-center rounded-[5px] bg-white/8 px-[7px] text-[15px] font-extrabold italic leading-5 tracking-[0.04em] text-white/85 ring-1 ring-inset ring-white/30"
                >
                    {strip.target}
                </span>
            )}
        </div>
    )
}
