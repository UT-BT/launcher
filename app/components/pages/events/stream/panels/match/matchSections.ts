import type { ComponentType } from 'react'

export type MatchSectionId = 'current' | 'lineup' | 'score' | 'countdown'

export interface MatchSectionEntry {
    id: MatchSectionId
    label: string
    load: () => Promise<{ default: ComponentType }>
}

export const MATCH_SECTIONS: MatchSectionEntry[] = [
    { id: 'current', label: 'Current match', load: () => import('./CurrentMatchSection').then(m => ({ default: m.CurrentMatchSection })) },
    { id: 'lineup', label: 'Lineup', load: () => import('./LineupSection').then(m => ({ default: m.LineupSection })) },
    { id: 'score', label: 'Score', load: () => import('./ScoreSection').then(m => ({ default: m.ScoreSection })) },
    { id: 'countdown', label: 'Countdown', load: () => import('./CountdownSection').then(m => ({ default: m.CountdownSection })) },
]
