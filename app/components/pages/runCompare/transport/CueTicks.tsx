import { cn } from '@/lib/utils'
import type { CueKind, CuePoint } from '../model/cueModel'
import { formatRaceTime } from '../model/raceModel'

interface CueTicksProps {
    label: string
    kind: CueKind
    points: readonly CuePoint[]
    end: number
    active: string | null
    interactive: boolean
    onCue: (point: CuePoint) => void
}

function percent(value: number, of: number): string {
    return `${(Math.min(value, of) / of) * 100}%`
}

export function CueTicks({ label, kind, points, end, active, interactive, onCue }: CueTicksProps) {
    const endMs = end * 1000
    if (points.length === 0 || endMs <= 0) return null
    return (
        <ol aria-label={label} className={cn('run-compare-cues', kind === 'zone' && 'is-zones')}>
            {points.map(point => (
                <li
                    key={point.key}
                    className={cn('run-compare-cue', point.key === active && 'is-active')}
                    style={{ left: percent(point.atMs, endMs) }}
                >
                    {interactive ? (
                        <button type="button" aria-label={`Cue ${point.label}`} onClick={() => onCue(point)} />
                    ) : (
                        <span className="run-compare-cue-mark">
                            <span className="sr-only">{`${point.label} at ${formatRaceTime(point.atMs / 1000)}`}</span>
                        </span>
                    )}
                </li>
            ))}
        </ol>
    )
}
