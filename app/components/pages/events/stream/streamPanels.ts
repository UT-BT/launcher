import type { ComponentType } from 'react'

export type StreamPanelId = 'match' | 'cams' | 'score' | 'studio' | 'setup' | 'guide'

export type StreamPanelGroup = 'live' | 'setup'

export type StreamKitState = 'loading' | 'none' | 'downloaded' | 'unknown'

export interface StreamPanelEntry {
    id: StreamPanelId
    label: string
    group: StreamPanelGroup
    load: () => Promise<{ default: ComponentType }>
}

export const STREAM_PANELS: StreamPanelEntry[] = [
    { id: 'match', label: 'Match', group: 'live', load: () => import('./panels/MatchPanel').then(m => ({ default: m.MatchPanel })) },
    { id: 'cams', label: 'Cams', group: 'live', load: () => import('./panels/CamsPanel').then(m => ({ default: m.CamsPanel })) },
    { id: 'score', label: 'Score', group: 'live', load: () => import('./panels/ScorePanel').then(m => ({ default: m.ScorePanel })) },
    { id: 'studio', label: 'Studio', group: 'live', load: () => import('./panels/StudioPanel').then(m => ({ default: m.StudioPanel })) },
    { id: 'setup', label: 'Setup', group: 'setup', load: () => import('./panels/SetupPanel').then(m => ({ default: m.SetupPanel })) },
    { id: 'guide', label: 'Guide', group: 'setup', load: () => import('./panels/GuidePanel').then(m => ({ default: m.GuidePanel })) },
]

export function isStreamPanelId(value: string | null): value is StreamPanelId {
    return STREAM_PANELS.some(panel => panel.id === value)
}

export function initialStreamPanel(remembered: string | null, kit: StreamKitState): StreamPanelId | null {
    if (isStreamPanelId(remembered)) return remembered
    if (kit === 'loading') return null
    return kit === 'none' ? 'setup' : 'match'
}
