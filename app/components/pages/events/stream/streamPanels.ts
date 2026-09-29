import type { ComponentType } from 'react'

export type StreamPanelId = 'match' | 'show' | 'channel' | 'scenes' | 'kit' | 'guide' | 'cams'

export interface StreamPanelEntry {
    id: StreamPanelId
    label: string
    load: () => Promise<{ default: ComponentType }>
}

export const STREAM_PANELS: StreamPanelEntry[] = [
    { id: 'match', label: 'Match', load: () => import('./panels/MatchPanel').then(m => ({ default: m.MatchPanel })) },
    { id: 'show', label: 'Show', load: () => import('./panels/ShowPanel').then(m => ({ default: m.ShowPanel })) },
    { id: 'channel', label: 'Channel', load: () => import('./panels/ChannelPanel').then(m => ({ default: m.ChannelPanel })) },
    { id: 'scenes', label: 'Scenes', load: () => import('./panels/ScenesPanel').then(m => ({ default: m.ScenesPanel })) },
    { id: 'kit', label: 'Kit', load: () => import('./panels/KitPanel').then(m => ({ default: m.KitPanel })) },
    { id: 'guide', label: 'Guide', load: () => import('./panels/GuidePanel').then(m => ({ default: m.GuidePanel })) },
    { id: 'cams', label: 'Cams', load: () => import('./panels/CamsPanel').then(m => ({ default: m.CamsPanel })) },
]
