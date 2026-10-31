import { DELTA_COLORS } from '@/app/components/pages/capDetail/capStats'
import type { DeltaTone } from './deltaCurve'

export const TONE_STROKE: Record<DeltaTone, string> = {
    ahead: DELTA_COLORS.gained,
    behind: DELTA_COLORS.lost,
    even: DELTA_COLORS.neutral,
}

export const TONE_AREA: Record<DeltaTone, string> = {
    ahead: `${DELTA_COLORS.gained}24`,
    behind: `${DELTA_COLORS.lost}24`,
    even: 'transparent',
}

export const TONE_TEXT: Record<DeltaTone, string> = {
    ahead: 'text-emerald-300',
    behind: 'text-red-300',
    even: 'text-muted-foreground',
}

export const HAIRLINE = (alpha: number) => `rgb(var(--hairline-rgb) / ${alpha})`
