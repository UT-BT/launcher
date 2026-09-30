import { streamMatchReadPath, type StreamLineupSlot, type StreamSide, type StreamUserRef } from '../../data/streamHotState'

export interface NextMapVideo {
    available: boolean
    version: string | null
    url: string | null
}

export interface NextMapDetails {
    name: string
    mapper: string | null
    kind: string
    picked_by: StreamSide | null
    screenshot_version: string | null
    screenshot_url: string | null
    video: NextMapVideo
}

export interface NextMapTime {
    time_seconds: number
    verified: boolean
}

export interface NextMapPlayer extends StreamUserRef {
    pb: NextMapTime | null
}

export interface NextMapCupRun extends NextMapTime {
    team: { id: string; name: string } | null
    players: StreamUserRef[]
}

export interface NextMapRead {
    server_now: string
    match_id: string
    ordinal: number
    map: NextMapDetails | null
    team_wr: { time_seconds: number; holders: StreamUserRef[][] } | null
    lineup: Record<StreamLineupSlot, NextMapPlayer | null>
    cup_history: { times_played: number; fastest_run: NextMapCupRun | null } | null
}

export function nextMapReadPath(eventSlug: string, matchId: string, ordinal: number): string {
    return streamMatchReadPath(eventSlug, matchId, `next-map/${ordinal}`)
}
