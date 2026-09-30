import type { ComponentType } from 'react'

export type MatchSectionId = 'current' | 'lineup' | 'streaming-on' | 'countdown'

export interface MatchSectionEntry {
    id: MatchSectionId
    label: string
    load: () => Promise<{ default: ComponentType }>
}

export const MATCH_SECTIONS: MatchSectionEntry[] = [
    { id: 'current', label: 'Current match', load: () => import('./CurrentMatchSection').then(m => ({ default: m.CurrentMatchSection })) },
    { id: 'lineup', label: 'Lineup', load: () => import('./LineupSection').then(m => ({ default: m.LineupSection })) },
    { id: 'streaming-on', label: 'Streaming on', load: () => import('../channel/StreamingOnSection').then(m => ({ default: m.StreamingOnSection })) },
    { id: 'countdown', label: 'Countdown', load: () => import('./CountdownSection').then(m => ({ default: m.CountdownSection })) },
]
