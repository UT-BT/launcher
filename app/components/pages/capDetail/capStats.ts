import { getMedalIcon } from '@/app/utils/medals'
import { formatCapTime } from '@/app/utils/format'
import type { CapCheckpoint } from '@/app/utils/api'

// Cap.medal is the backend Medal enum int (0..6). Map to the launcher's
// medal-icon keys + display labels.
const MEDAL_INT_TO_KEY: Record<number, string> = {
    6: 'world record',
    5: 'champion medal',
    4: 'gold medal',
    3: 'silver medal',
    2: 'bronze medal',
    1: 'certified',
    0: 'casual',
}

const MEDAL_INT_TO_LABEL: Record<number, string> = {
    6: 'World Record',
    5: 'Champion',
    4: 'Gold',
    3: 'Silver',
    2: 'Bronze',
    1: 'Certified',
    0: 'Casual',
}

export function medalIconForInt(medal: number | null | undefined): string | null {
    if (medal == null) return null
    return getMedalIcon(MEDAL_INT_TO_KEY[medal] ?? '')
}

export function medalLabelForInt(medal: number | null | undefined): string {
    if (medal == null) return 'Casual'
    return MEDAL_INT_TO_LABEL[medal] ?? 'Casual'
}

const CAP_TYPE_LABEL: Record<number, string> = {
    1: 'UTBT',
    2: 'Certified',
    3: 'i4Games',
}

export function capTypeLabel(capType: number | null | undefined): string {
    if (capType == null) return 'Casual'
    return CAP_TYPE_LABEL[capType] ?? 'Casual'
}

/** Signed delta string, e.g. "+0.184", "−1.204", "±0.000". Uses a minus glyph
 *  for negatives so it lines up with the leading "+". */
export function formatSignedDelta(seconds: number | null | undefined): string {
    if (seconds == null) return '—'
    const abs = Math.abs(seconds)
    const body = abs < 60 ? abs.toFixed(3) : formatCapTime(abs)
    if (seconds > 0) return `+${body}`
    if (seconds < 0) return `−${body}`
    return `±${body}`
}

export function deltaClass(seconds: number | null | undefined, aheadIsGood = true): string {
    if (seconds == null || seconds === 0) return 'text-muted-foreground'
    const ahead = seconds < 0
    const good = aheadIsGood ? ahead : !ahead
    return good ? 'text-emerald-300' : 'text-red-300'
}

export interface DeltaPoint {
    label: string
    delta: number
}

export function buildDeltaPoints(
    checkpoints: CapCheckpoint[],
    baseline: CapCheckpoint[],
    capTime: number,
    baselineTime: number | null,
): DeltaPoint[] {
    const baseByZone = new Map(baseline.map(c => [c.zone, c.cumulative]))
    const points: DeltaPoint[] = [{ label: 'SPAWN', delta: 0 }]

    let i = 0
    for (const cp of checkpoints) {
        const base = baseByZone.get(cp.zone)
        if (base == null) continue
        i += 1
        points.push({ label: `CP${i}`, delta: round3(cp.cumulative - base) })
    }

    if (baselineTime != null) {
        points.push({ label: 'CAP', delta: round3(capTime - baselineTime) })
    }

    return points
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000
}

export function toNum(v: unknown): number | null {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
}

export interface PercentileAnchors {
    min: number | null
    p10: number | null
    p50: number | null
    p90: number | null
}

export function estimateBeatFraction(
    value: number,
    m: PercentileAnchors,
    lowerIsBetter = true,
): number | null {
    const anchors: [number, number][] = []
    if (m.min != null) anchors.push([m.min, lowerIsBetter ? 0.99 : 0.01])
    if (m.p10 != null) anchors.push([m.p10, lowerIsBetter ? 0.90 : 0.10])
    if (m.p50 != null) anchors.push([m.p50, 0.50])
    if (m.p90 != null) anchors.push([m.p90, lowerIsBetter ? 0.10 : 0.90])
    if (anchors.length < 2) return null

    anchors.sort((a, b) => a[0] - b[0])
    if (value <= anchors[0][0]) return anchors[0][1]
    if (value >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1]
    for (let i = 0; i < anchors.length - 1; i++) {
        const [v0, f0] = anchors[i]
        const [v1, f1] = anchors[i + 1]
        if (value >= v0 && value <= v1) {
            const t = v1 === v0 ? 0 : (value - v0) / (v1 - v0)
            return f0 + t * (f1 - f0)
        }
    }
    return null
}

export function topPercent(beatFraction: number): number {
    return Math.min(99, Math.max(1, Math.round((1 - beatFraction) * 100)))
}

export function formatStatValue(v: number | null | undefined, format: 'sec' | 'int' = 'sec'): string {
    if (v == null) return '—'
    if (format === 'int') return Number.isInteger(v) ? String(v) : v.toFixed(0)
    return Number.isInteger(v) ? `${v}` : v.toFixed(3)
}

export interface MovementMetricMeta {
    label: string
    description: string
    unit?: string
}

export const MOVEMENT_HEADLINE_META: Record<string, MovementMetricMeta> = {
    dodge_block_50pc: {
        label: 'Dodge Block',
        unit: 's',
        description: 'Median dodge-block timing. Tighter (lower) means cleaner, more deliberate dodges.',
    },
    dodge_double_tap_50pc: {
        label: 'Double Tap',
        unit: 's',
        description: 'Median gap between the two taps of a dodge. Lower = snappier dodge inputs.',
    },
    dodge_after_landing_50pc: {
        label: 'Dodge After Landing',
        unit: 's',
        description: 'Median delay before dodging again after landing. Lower = faster chaining.',
    },
    time_between_dodges_50pc: {
        label: 'Time Between Dodges',
        unit: 's',
        description: 'Median time between consecutive dodges. Lower = a higher sustained dodge rate.',
    },
}

export interface AdvancedStat {
    key: string
    label: string
    description: string
    format: 'sec' | 'int'
}

export const MOVEMENT_ADVANCED_GROUPS: { title: string; stats: AdvancedStat[] }[] = [
    {
        title: 'Dodge detail',
        stats: [
            { key: 'real_dodge_double_tap_50pc', label: 'Real Double Tap', description: 'Median genuine double-tap interval (seconds), filtering accidental taps.', format: 'sec' },
            { key: 'dodge_init_after_landing_50pc', label: 'Dodge Init After Landing', description: 'Median time to begin a dodge after landing (seconds).', format: 'sec' },
            { key: 'key_presses_before_dodge_50pc', label: 'Keys Before Dodge', description: 'Median number of extra key presses before a dodge fires. Lower = cleaner input.', format: 'int' },
            { key: 'key_presses_after_dodge_50pc', label: 'Keys After Dodge', description: 'Median key presses immediately after a dodge.', format: 'int' },
            { key: 'dodge_bind_uses', label: 'Dodge Bind Uses', description: 'How many dodges used a single-key dodge bind rather than a manual double tap.', format: 'int' },
        ],
    },
    {
        title: 'Movement bursts',
        stats: [
            { key: 'jump_burst_count', label: 'Jump', description: 'Count of rapid jump-input bursts during the run.', format: 'int' },
            { key: 'forward_burst_count', label: 'Forward', description: 'Count of rapid forward-input bursts.', format: 'int' },
            { key: 'back_burst_count', label: 'Back', description: 'Count of rapid back-input bursts.', format: 'int' },
            { key: 'left_burst_count', label: 'Left', description: 'Count of rapid left-input bursts.', format: 'int' },
            { key: 'right_burst_count', label: 'Right', description: 'Count of rapid right-input bursts.', format: 'int' },
        ],
    },
]
