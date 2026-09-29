import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint } from '@/app/components/broadcast/broadcastTone'
import { EASE_OVERSHOOT } from '@/app/components/broadcast/broadcastMotion'
import { displayMapName } from '@/app/utils/format'
import type { StreamMatch } from '../../data/streamHotState'
import { formatLabel, sideToneClasses } from '../../sceneHelpers'
import { teamLabel, type SeriesMapView } from './intermissionView'
import { revealDelayS, type MapReveal } from './useMapReveal'

function headlineSize(text: string): number {
    if (text.length <= 24) return 96
    if (text.length <= 32) return 76
    return 60
}

function capsText(map: SeriesMapView): string {
    return `${map.caps?.a ?? '–'}–${map.caps?.b ?? '–'}`
}

export function MapHeadline({ match, latest, reveal }: { match: StreamMatch; latest: SeriesMapView | null; reveal: MapReveal }) {
    if (!latest) {
        return (
            <div className="pb-[26px]">
                <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">{formatLabel(match)}</p>
                <p className="mt-2.5 text-8xl font-black italic uppercase leading-none">Map 1 up next</p>
            </div>
        )
    }

    const winner = latest.winner
    const team = winner ? teamLabel(match, winner) : null
    const rest = winner ? ` take map ${latest.number}` : `Map ${latest.number} ends level`
    const hue = PICK_BAN_HUES[winner ?? 'gold']
    const revealing = reveal?.ordinals.at(-1) === latest.ordinal
    const mapName = latest.map ? ` · ${displayMapName(latest.map)}` : ''

    return (
        <div className="pb-[26px]">
            <p className={cn('text-lg font-bold uppercase tracking-[0.3em]', PICK_BAN_TONES.gold.text)}>
                Map {latest.number} decided{mapName} · {capsText(latest)}
            </p>
            <motion.p
                key={revealing ? `reveal-${reveal?.seq}` : 'still'}
                data-map-headline={latest.number}
                initial={revealing ? { opacity: 0, scale: 1.25, x: -24 } : false}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.45, ease: EASE_OVERSHOOT, delay: revealing ? revealDelayS(reveal, latest.ordinal) - 0.2 : 0 }}
                className="mt-2.5 origin-left font-black italic uppercase leading-none"
                style={{ fontSize: headlineSize(`${team ?? ''}${rest}`), textShadow: `0 0 40px ${tint(hue, 55)}` }}
            >
                {team && winner && <span className={sideToneClasses(winner).text}>{team}</span>}
                {rest}
            </motion.p>
        </div>
    )
}
