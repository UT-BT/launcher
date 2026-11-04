import { cn } from '@/lib/utils'
import { zoneLabel } from '../analysis/analysisLabels'
import type { CueKind, CuePoint } from '../model/cueModel'
import { formatRaceTime } from '../model/raceModel'

interface CueTicksProps {
    label: string
    kind: CueKind
    points: readonly CuePoint[]
    end: number
    active: string | null
    interactive: boolean
    labelled: boolean
    onCue: (point: CuePoint) => void
}

function percent(value: number, of: number): string {
    return `${(Math.min(value, of) / of) * 100}%`
}

function nameOf(point: CuePoint): string {
    return point.kind === 'zone' ? zoneLabel(point.label) : point.label
}

export function CueTicks({ label, kind, points, end, active, interactive, labelled, onCue }: CueTicksProps) {
    const endMs = end * 1000
    if (points.length === 0 || endMs <= 0) return null
    return (
        <ol aria-label={label} className={cn('run-compare-cues', kind === 'zone' && 'is-zones', labelled && 'is-labelled')}>
            {points.map(point => (
                <li
                    key={point.key}
                    className={cn('run-compare-cue', point.key === active && 'is-active')}
                    style={{ left: percent(point.atMs, endMs) }}
                >
                    {interactive ? (
                        <button type="button" aria-label={`Jump to ${nameOf(point)}`} onClick={() => onCue(point)}>
                            {labelled && <span aria-hidden className="run-compare-cue-label">{point.label}</span>}
                        </button>
                    ) : (
                        <span className="run-compare-cue-mark">
                            <span className="sr-only">{`${nameOf(point)} at ${formatRaceTime(point.atMs / 1000)}`}</span>
                            {labelled && <span aria-hidden className="run-compare-cue-label">{point.label}</span>}
                        </span>
                    )}
                </li>
            ))}
        </ol>
    )
}
