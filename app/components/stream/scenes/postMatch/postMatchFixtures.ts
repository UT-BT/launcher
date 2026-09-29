import type { StreamMatch, StreamSide } from '../../data/streamHotState'
import { STREAM_MATCH_ID, STREAM_T0, streamIso, streamMapScore, streamMaps, streamMatch, streamScore } from '../../data/streamFixtures'
import type {
    BracketConsequenceTeam,
    GroupConsequenceTeam,
    PostMatchConsequence,
    PostMatchNextMatch,
    PostMatchRead,
    SwissConsequenceTeam,
} from './postMatchRead'

export const POST_MATCH_MAPS = ['CTF-BT-II-Synchronize-VF2', 'CTF-BT-II-MountainBase', 'CTF-BT-II-FuriumMineCE2', 'CTF-BT-II-FaithCB']
export const POST_MATCH_PICKS: StreamSide[] = ['a', 'b', 'b', 'a']

export function decidedMatch(overrides: Partial<StreamMatch> = {}): StreamMatch {
    const scores = [
        streamMapScore(1, [2, 1], 'a', { source: 'live' }),
        streamMapScore(2, [0, 2], 'b', { source: 'live' }),
        streamMapScore(3, [2, 1], 'a', { source: 'live' }),
        streamMapScore(4, [2, 0], 'a', { source: 'live' }),
    ]
    return streamMatch({
        reason: 'current',
        status: 'live',
        pick_ban_status: 'complete',
        live_at: streamIso(STREAM_T0 - 90 * 60_000),
        maps: streamMaps(POST_MATCH_MAPS, POST_MATCH_PICKS),
        score: streamScore(scores, { winner: 'a', live_decided: true, current_map: null }),
        ...overrides,
    })
}

export function officialMatch(overrides: Partial<StreamMatch> = {}): StreamMatch {
    const scores = [
        streamMapScore(1, [2, 1], 'a'),
        streamMapScore(2, [0, 2], 'b'),
        streamMapScore(3, [2, 1], 'a'),
        streamMapScore(4, [2, 0], 'a'),
    ]
    return decidedMatch({ status: 'complete', score: streamScore(scores, { winner: 'a', live_decided: true, current_map: null }), ...overrides })
}

export function inProgressMatch(overrides: Partial<StreamMatch> = {}): StreamMatch {
    const scores = [
        streamMapScore(1, [2, 1], 'a', { source: 'live' }),
        streamMapScore(2, [0, 2], 'b', { source: 'live' }),
        streamMapScore(3, [1, 1], null),
        streamMapScore(4),
    ]
    return decidedMatch({ score: streamScore(scores), ...overrides })
}

export function groupTeam(teamId: string, position: number, points: number, overrides: Partial<GroupConsequenceTeam> = {}): GroupConsequenceTeam {
    return { team_id: teamId, position, of: 6, played: 4, wins: 3, draws: 1, losses: 0, points, ...overrides }
}

export function groupConsequence(winner: StreamSide | null = 'a'): PostMatchConsequence {
    return {
        kind: 'group',
        winner,
        group: { id: 'group-b', name: 'Group B' },
        teams: {
            a: groupTeam('team-crimson', 2, 10),
            b: groupTeam('team-azure', 3, 6, { wins: 2, draws: 0, losses: 2 }),
        },
    }
}

export function nextMatch(stage: { key: string; name: string }, label: string | null, overrides: Partial<PostMatchNextMatch> = {}): PostMatchNextMatch {
    return { id: 'match-9', stage, round: { no: 2, label }, scheduled_at: streamIso(STREAM_T0 + 24 * 60 * 60_000), ...overrides }
}

export function bracketConsequence(a: Partial<BracketConsequenceTeam>, b: Partial<BracketConsequenceTeam>, winner: StreamSide | null = 'a'): PostMatchConsequence {
    return {
        kind: 'bracket',
        winner,
        group: null,
        teams: {
            a: { team_id: 'team-crimson', outcome: 'next_match', next_match: null, ...a },
            b: { team_id: 'team-azure', outcome: 'eliminated', next_match: null, ...b },
        },
    }
}

export function swissConsequence(a: Partial<SwissConsequenceTeam>, b: Partial<SwissConsequenceTeam>, winner: StreamSide | null = 'a'): PostMatchConsequence {
    return {
        kind: 'swiss',
        winner,
        group: null,
        teams: {
            a: { team_id: 'team-crimson', wins: 3, losses: 1, status: 'qualified', ...a },
            b: { team_id: 'team-azure', wins: 1, losses: 3, status: 'eliminated', ...b },
        },
    }
}

export function postMatchRead(overrides: Partial<PostMatchRead> = {}): PostMatchRead {
    return { server_now: streamIso(STREAM_T0), match_id: STREAM_MATCH_ID, official: false, consequence: null, ...overrides }
}

export function officialRead(consequence: PostMatchConsequence = groupConsequence(), overrides: Partial<PostMatchRead> = {}): PostMatchRead {
    return postMatchRead({ official: true, consequence, ...overrides })
}
