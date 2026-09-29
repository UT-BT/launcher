import type { StreamMatch } from '../../data/streamHotState'
import { STREAM_MATCH_ID, STREAM_T0, streamIso, streamMatch, streamMember, streamTeam, streamTitle, streamUserRef } from '../../data/streamFixtures'
import type { FeedMatch, FeedResult } from '../../ticker/streamFeed'
import type { StartingSoonBetting, StartingSoonFeed } from './startingSoonReads'

const MINUTE = 60_000

const SOON_MEMBERS = {
    a: [
        streamMember('310000000000000001', 'Ada', { captain: true, title: streamTitle('Cap Machine', 3, [230, 120, 40]) }),
        streamMember('310000000000000002', 'Ben', { title: streamTitle('Speedrunner', 2, [31, 166, 230]) }),
    ],
    b: [
        streamMember('320000000000000001', 'Cleo', { captain: true, title: streamTitle('World Record Holder', 5) }),
        streamMember('320000000000000002', 'Dex', { title: streamTitle('Rookie', 1) }),
    ],
}

export function soonMatch(overrides: Partial<StreamMatch> = {}): StreamMatch {
    const a = streamTeam('a', { members: SOON_MEMBERS.a })
    const b = streamTeam('b', { members: SOON_MEMBERS.b })
    return streamMatch({
        teams: { a, b },
        lineup: { a1: streamUserRef(a.members[0]), a2: streamUserRef(a.members[1]), b1: streamUserRef(b.members[0]), b2: streamUserRef(b.members[1]) },
        ...overrides,
    })
}

export function soonBetting(overrides: Partial<StartingSoonBetting> = {}): StartingSoonBetting {
    return {
        state: 'open',
        market: { pool: 12_450, predictions: 164 },
        sides: { a: { price: 0.58, odds: 1.72 }, b: { price: 0.42, odds: 2.38 }, draw: null },
        ...overrides,
    }
}

export function soonBettingDisabled(): StartingSoonBetting {
    return { state: 'not_enabled', market: null, sides: null }
}

export function feedMatch(id: string, minutesFromT0: number, a: string | null, b: string | null, overrides: Partial<FeedMatch> = {}): FeedMatch {
    return {
        id,
        stage: { key: 'groups', name: 'Group Stage' },
        round: { no: 4, label: 'Round 4' },
        status: 'scheduled',
        scheduled_at: streamIso(STREAM_T0 + minutesFromT0 * MINUTE),
        stream_url: null,
        teams: { a: a === null ? null : { id: `team-${id}-a`, name: a }, b: b === null ? null : { id: `team-${id}-b`, name: b } },
        ...overrides,
    }
}

export function feedResult(id: string, minutesFromT0: number, a: string, b: string, score: [number, number], overrides: Partial<FeedResult> = {}): FeedResult {
    const winner = score[0] > score[1] ? 'a' : score[1] > score[0] ? 'b' : null
    return { ...feedMatch(id, minutesFromT0, a, b), status: 'complete', score: { a: score[0], b: score[1] }, winner, ...overrides }
}

export function soonFeed(overrides: Partial<StartingSoonFeed> = {}): StartingSoonFeed {
    return {
        results: [
            feedResult('r1', -250, 'Kinetic Kin', 'Triple Jump', [3, 1]),
            feedResult('r2', -160, 'Warp Rabbits', 'Ledge Lords', [3, 1]),
            feedResult('r3', -70, 'Moonhoppers', 'Double Dash', [2, 2]),
        ],
        upcoming: [
            feedMatch(STREAM_MATCH_ID, 80, 'Crimson Cats', 'Azure Owls', { stream_url: 'https://twitch.tv/bramble_bt' }),
            feedMatch('u1', 170, 'Strafe Society', 'Quad Damage', { stream_url: 'https://twitch.tv/utbt' }),
            feedMatch('u2', 200, 'Burrow Gang', 'Flagrunners', { stream_url: 'https://www.twitch.tv/bramble_bt/' }),
            feedMatch('u3', 290, 'Ctrl+Hop', 'Velvet Carrots'),
        ],
        ...overrides,
    }
}
