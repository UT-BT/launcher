import type { RawActiveTitle } from '@/app/utils/api'
import type {
    StreamHotState,
    StreamMapScore,
    StreamMatch,
    StreamMatchMap,
    StreamScore,
    StreamSide,
    StreamTeam,
    StreamTeamMember,
    StreamUserRef,
} from './streamHotState'

export const STREAM_T0 = Date.parse('2026-09-29T18:40:00Z')
export const STREAM_EVENT = { name: 'UTBT 2v2 World Cup 2026', slug: '2v2-cup-2026' }
export const STREAM_STREAMER_ID = '228152236587483136'
export const STREAM_MATCH_ID = 'match-1'

export function streamIso(ms: number): string {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

export function streamTitle(name: string, rarity = 3, color: [number, number, number] = [240, 180, 41]): RawActiveTitle {
    return { name, rarity, color_r: color[0], color_g: color[1], color_b: color[2] }
}

export function streamMember(id: string, displayName: string, overrides: Partial<StreamTeamMember> = {}): StreamTeamMember {
    return {
        id,
        display_name: displayName,
        avatar: `https://example.test/users/${id}/avatar`,
        title: null,
        captain: false,
        ...overrides,
    }
}

export function streamUserRef(member: StreamTeamMember): StreamUserRef {
    return { id: member.id, display_name: member.display_name, avatar: member.avatar }
}

const TEAMS: Record<StreamSide, StreamTeam> = {
    a: {
        id: 'team-crimson',
        name: 'Crimson Cats',
        match_side: 'a',
        stage_seed: 1,
        pre_cup_seed: 3,
        members: [streamMember('1000', 'Ada', { captain: true, title: streamTitle('Cap Machine') }), streamMember('1001', 'Ben')],
    },
    b: {
        id: 'team-azure',
        name: 'Azure Owls',
        match_side: 'b',
        stage_seed: 4,
        pre_cup_seed: 12,
        members: [streamMember('2000', 'Cleo', { captain: true }), streamMember('2001', 'Dex', { title: streamTitle('Speedrunner', 2, [31, 166, 230]) })],
    },
}

export function streamTeam(side: StreamSide, overrides: Partial<StreamTeam> = {}): StreamTeam {
    return { ...TEAMS[side], ...overrides }
}

export function streamMapScore(ordinal: number, caps: [number, number] = [0, 0], winner: StreamSide | null = null, overrides: Partial<StreamMapScore> = {}): StreamMapScore {
    const decided = winner !== null
    return {
        ordinal,
        caps: { a: caps[0], b: caps[1] },
        decided,
        winner,
        source: decided ? 'official' : 'live',
        closed_by: decided ? 'official' : null,
        pins: { a: null, b: null },
        winner_override: 'auto',
        ...overrides,
    }
}

export function streamScore(maps: StreamMapScore[], overrides: Partial<StreamScore> = {}): StreamScore {
    const series = {
        a: maps.filter(map => map.winner === 'a').length,
        b: maps.filter(map => map.winner === 'b').length,
    }
    const current = maps.find(map => !map.decided)
    return { maps, current_map: current?.ordinal ?? null, series, winner: null, live_decided: false, live_counting: true, ...overrides }
}

export function streamMaps(names: string[], pickedBy: (StreamSide | null)[] = []): StreamMatchMap[] {
    return names.map((map, index) => ({ ordinal: index, map, kind: 'normal', picked_by: pickedBy[index] ?? null }))
}

export function streamMatch(overrides: Partial<StreamMatch> = {}): StreamMatch {
    const a = streamTeam('a')
    const b = streamTeam('b')
    const scheduledAt = streamIso(STREAM_T0 + 80 * 60_000)
    const bestOf = overrides.best_of ?? 4
    const ordinals = Array.from({ length: bestOf }, (_, index) => index)
    return {
        id: STREAM_MATCH_ID,
        reason: 'next',
        stage: { key: 'groups', name: 'Group Stage' },
        group: { id: 'group-b', name: 'Group B' },
        round: { no: 4, label: 'Round 4' },
        best_of: bestOf,
        mode: 'first_to',
        caps_to_win: 2,
        scheduled_at: scheduledAt,
        countdown_at: scheduledAt,
        live_at: null,
        status: 'scheduled',
        stream_url: 'https://twitch.tv/utbt',
        pick_ban_status: 'none',
        sides: { a: 'a', b: 'b' },
        teams: { a, b },
        lineup: {
            a1: streamUserRef(a.members[0]),
            a2: streamUserRef(a.members[1]),
            b1: streamUserRef(b.members[0]),
            b2: streamUserRef(b.members[1]),
        },
        maps: [],
        score: streamScore(ordinals.map(ordinal => streamMapScore(ordinal))),
        casters: [],
        ...overrides,
    }
}

export function streamHotState(overrides: Partial<StreamHotState> = {}): StreamHotState {
    const match = overrides.match === undefined ? streamMatch() : overrides.match
    return {
        server_now: streamIso(STREAM_T0),
        event: STREAM_EVENT,
        streamer: { id: STREAM_STREAMER_ID, display_name: 'Bramble', channel: 'https://twitch.tv/bramble_bt' },
        desk: { brb_message: null, webcam_enabled: false },
        reason: match?.reason ?? 'none',
        match,
        ...overrides,
    }
}

export function idleHotState(overrides: Partial<StreamHotState> = {}): StreamHotState {
    return streamHotState({ reason: 'none', match: null, ...overrides })
}
