import { getMedalIcon } from '@/app/utils/medals'
import { formatCapTime } from '@/app/utils/format'
import type { CapCheckpoint } from '@/app/utils/api'

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

export const DELTA_COLORS = { gained: '#10B981', lost: '#EF4444', neutral: '#64748B' } as const

export function segmentColor(change: number): string {
    if (change < -1e-6) return DELTA_COLORS.gained
    if (change > 1e-6) return DELTA_COLORS.lost
    return DELTA_COLORS.neutral
}

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

export interface SyncAnchor {
    label: string
    aTime: number
    bTime: number
}

const MISMATCH_FLOOR = 0.06
const MISMATCH_RATIO = 4

export function buildSyncAnchors(
    checkpoints: CapCheckpoint[],
    baseline: CapCheckpoint[],
    capTime: number,
    baselineTime: number | null,
): SyncAnchor[] {
    const baseByZone = new Map(baseline.map(c => [c.zone, c.cumulative]))
    const canNorm = baselineTime != null && capTime > 0 && baselineTime > 0

    const cands = checkpoints
        .map(cp => {
            const base = baseByZone.get(cp.zone)
            if (base == null) return null
            const mismatch = canNorm ? Math.abs(cp.cumulative / capTime - base / baselineTime!) : 0
            return { aTime: cp.cumulative, bTime: base, mismatch }
        })
        .filter((c): c is { aTime: number; bTime: number; mismatch: number } => c != null)

    const kept = cands.filter((c, i) => {
        if (c.mismatch <= MISMATCH_FLOOR) return true
        const neighbour = Math.max(cands[i - 1]?.mismatch ?? 0, cands[i + 1]?.mismatch ?? 0)
        return c.mismatch <= MISMATCH_RATIO * neighbour
    })

    const anchors: SyncAnchor[] = [{ label: 'SPAWN', aTime: 0, bTime: 0 }]
    kept.forEach((c, i) => anchors.push({ label: `CP${i + 1}`, aTime: c.aTime, bTime: c.bTime }))
    if (baselineTime != null) {
        anchors.push({ label: 'CAP', aTime: capTime, bTime: baselineTime })
    }
    return anchors
}

export function buildDeltaPoints(
    checkpoints: CapCheckpoint[],
    baseline: CapCheckpoint[],
    capTime: number,
    baselineTime: number | null,
): DeltaPoint[] {
    return buildSyncAnchors(checkpoints, baseline, capTime, baselineTime)
        .map(a => ({ label: a.label, delta: round3(a.aTime - a.bTime) }))
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000
}

export function toNum(v: unknown): number | null {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
}
