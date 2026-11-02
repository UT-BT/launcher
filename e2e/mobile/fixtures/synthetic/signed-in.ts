import type {
    MedalHuntOpportunity,
    PendingReview,
    SummaryCap,
    UserSummaryCapItAll,
    UserSummaryCounts,
    UserSummaryMedals,
    UserSummaryRecentWr,
} from '../../../../app/utils/api'
import { ROLE } from '../../../../app/utils/roles'
import { recordedFixtureSet } from '../recording'
import { ok, type FixtureReply, type FixtureSet } from '../types'
import { daysAgo, hoursAgo, person, syntheticMap, TITLE, VIEWER } from './people'
import { sessionRoutes } from './session'

const MEDALS = ['World Record', 'Champion Medal', 'Gold Medal', 'Silver Medal', 'Bronze Medal', 'None']

function summaryCap(index: number): SummaryCap {
    const team = index % 5 === 2
    return {
        id: `00000000-0000-4000-9000-${String(index).padStart(12, '0')}`,
        mapName: syntheticMap(index),
        author: person(index + 70).alias,
        difficulty: (index % 10) + 1,
        time: 37.42 + index * 2.37,
        medal: MEDALS[index % MEDALS.length],
        added: hoursAgo(index * 9 + 1),
        verified: index % 3 !== 1,
        isTeam: team,
        teamMembers: team ? [
            { userId: VIEWER.id, alias: VIEWER.alias, activeTitle: TITLE },
            { userId: person(index).id, alias: person(index).alias, activeTitle: TITLE },
        ] : null,
        teamCapId: team ? `00000000-0000-4000-a000-${String(index).padStart(12, '0')}` : null,
    }
}

function summaryCaps(url: URL): FixtureReply {
    const limit = Number(url.searchParams.get('limit') ?? 50) || 50
    const offset = Number(url.searchParams.get('offset') ?? 0) || 0
    const total = 180
    return ok(Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) => summaryCap(offset + index)))
}

const medals: UserSummaryMedals = {
    user_id: VIEWER.id,
    world_records: 12,
    champion_medals: 48,
    gold_medals: 131,
    silver_medals: 97,
    bronze_medals: 64,
    certified_caps: 402,
    points: 18342,
    rank: 37,
}

const counts: UserSummaryCounts = {
    total_caps: 1290,
    verified_caps: 1104,
    disallowed_caps: 3,
    certified_caps: 402,
    unique_maps: 388,
    uncapped_maps: 156,
    total_playtime_seconds: 1_284_000,
    spectator_playtime_seconds: 92_000,
    map_review_count: 41,
    wr_count: 12,
    favorite_count: 19,
}

const capItAll: UserSummaryCapItAll = { rank: 58, team_caps: 214 }

const recentWrs: UserSummaryRecentWr[] = Array.from({ length: 5 }, (_, index) => ({
    cap_id: summaryCap(index * 6).id,
    mapName: syntheticMap(index * 6),
    time: 41.2 + index,
    added: daysAgo(index * 4 + 1),
}))

const userSummary = {
    profile: {
        id: VIEWER.id,
        alias: VIEWER.alias,
        registered_at: daysAgo(900),
        twitch_url: 'https://twitch.tv/example',
        flag: VIEWER.flag,
        utbt_role: ROLE.USER,
        active_title: TITLE,
        active_ban: null,
    },
    medals,
    counts,
    capItAll,
    recentCaps: Array.from({ length: 10 }, (_, index) => summaryCap(index)),
    recentWrs,
}

const medalHunt: MedalHuntOpportunity[] = Array.from({ length: 6 }, (_, index) => ({
    mapName: syntheticMap(index + 20),
    difficulty: (index % 10) + 1,
    currentTime: 52.4 + index,
    targetTime: 50.1 + index,
    targetMedal: (['Bronze Medal', 'Silver Medal', 'Gold Medal', 'Champion Medal', 'World Record'] as const)[index % 5],
    improvement: 2.3,
    improvementPct: 4.4,
    worldRecordAdded: daysAgo(index * 30 + 5),
}))

const pendingReviews: { total: number; items: PendingReview[] } = {
    total: 23,
    items: Array.from({ length: 10 }, (_, index) => ({
        id: `synthetic-pending-${index + 1}`,
        mapName: syntheticMap(index + 30),
        timeAgo: `${index + 1} days ago`,
    })),
}

export const SIGNED_IN_SET: FixtureSet = {
    name: 'home-signed-in',
    routes: [
        ...sessionRoutes(ROLE.USER),
        { host: 'api', path: `/v2/summary/user/${VIEWER.id}`, reply: ok(userSummary) },
        { host: 'api', path: '/v2/summary/medal_hunt', reply: ok({ opportunities: medalHunt }) },
        { host: 'api', path: '/v2/summary/pending_reviews', reply: ok(pendingReviews) },
        { host: 'api', path: '/v2/summary/caps', reply: summaryCaps },
        { host: 'api', path: '/me/predictions/upcoming', reply: ok({ items: [] }) },
        ...recordedFixtureSet('home').routes,
    ],
}
