import type { PickBanActor } from '@/app/utils/api'

export type PickBanTone = 'a' | 'b' | 'gold' | 'neutral'

export interface PickBanToneClasses {
    text: string
    border: string
    line: string
    soft: string
    solid: string
    onSolid: string
    ring: string
    wash: string
}

export const PICK_BAN_TONES: Record<PickBanTone, PickBanToneClasses> = {
    a: {
        text: 'text-pickban-a',
        border: 'border-pickban-a',
        line: 'border-pickban-a/45',
        soft: 'bg-pickban-a/15',
        solid: 'bg-pickban-a',
        onSolid: 'text-white',
        ring: 'ring-pickban-a/60',
        wash: 'from-pickban-a/15',
    },
    b: {
        text: 'text-pickban-b',
        border: 'border-pickban-b',
        line: 'border-pickban-b/45',
        soft: 'bg-pickban-b/15',
        solid: 'bg-pickban-b',
        onSolid: 'text-white',
        ring: 'ring-pickban-b/60',
        wash: 'from-pickban-b/15',
    },
    gold: {
        text: 'text-pickban-gold',
        border: 'border-pickban-gold',
        line: 'border-pickban-gold/55',
        soft: 'bg-pickban-gold/20',
        solid: 'bg-pickban-gold',
        onSolid: 'text-neutral-950',
        ring: 'ring-pickban-gold/60',
        wash: 'from-pickban-gold/15',
    },
    neutral: {
        text: 'text-muted-foreground',
        border: 'border-hairline/30',
        line: 'border-hairline/10',
        soft: 'bg-hairline/5',
        solid: 'bg-hairline/20',
        onSolid: 'text-foreground',
        ring: 'ring-hairline/20',
        wash: 'from-hairline/5',
    },
}

export const PICK_BAN_HUES: Record<PickBanTone, string> = {
    a: 'var(--color-pickban-a)',
    b: 'var(--color-pickban-b)',
    gold: 'var(--color-pickban-gold)',
    neutral: 'var(--color-hairline)',
}

export function teamTone(ab: PickBanActor | null): PickBanTone {
    if (ab === 'A') return 'a'
    if (ab === 'B') return 'b'
    return 'neutral'
}

export function stepTone(actor: PickBanActor | null): PickBanTone {
    return actor === null ? 'gold' : teamTone(actor)
}
