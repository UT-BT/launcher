import { streamMatchReadPath, type StreamLineupSlot, type StreamSide, type StreamUserRef } from '../../data/streamHotState'

export interface IntermissionPb {
    time_seconds: number
    verified: boolean
}

export interface IntermissionPlayer {
    id: string
    display_name: string | null
    avatar: string | null
    pb: IntermissionPb | null
}

export interface IntermissionMap {
    name: string
    mapper: string | null
    screenshot_version: string | null
    screenshot_url: string | null
}

export interface IntermissionRead {
    server_now: string
    match_id: string
    ordinal: number
    kind: string
    picked_by: StreamSide | null
    map: IntermissionMap | null
    team_wr: { time_seconds: number; holders: StreamUserRef[][] } | null
    lineup: Record<StreamLineupSlot, IntermissionPlayer | null>
}

export function intermissionReadPath(eventSlug: string, matchId: string, ordinal: number): string {
    return streamMatchReadPath(eventSlug, matchId, `intermission/${ordinal}`)
}
