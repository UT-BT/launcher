import type { CSSProperties } from 'react'
import { ACCENT_SLOT_COUNT } from './statsView'
import './teamAccents.css'

export function teamAccentColor(slot: number): string {
    const wrapped = ((slot % ACCENT_SLOT_COUNT) + ACCENT_SLOT_COUNT) % ACCENT_SLOT_COUNT
    return `var(--team-accent-${wrapped})`
}

export function teamAccentStyle(slot: number): CSSProperties {
    return { '--team-accent': teamAccentColor(slot) } as CSSProperties
}
