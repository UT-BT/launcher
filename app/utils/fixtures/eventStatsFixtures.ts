import matchDetailLinks from './eventStats/match_detail_links.json'
import overviewAll from './eventStats/overview_all.json'
import overviewStageEmpty from './eventStats/overview_stage_empty.json'
import overviewUnpublished from './eventStats/overview_unpublished.json'
import review from './eventStats/review.json'
import team from './eventStats/team.json'
import teamNotFound from './eventStats/team_not_found.json'
import type { EventCapReview, EventMatch, EventStats, EventTeamStats } from '@/app/utils/api'

export interface EventStatsSuccessFixtures {
    overviewAll: EventStats
    overviewStageEmpty: EventStats
    overviewUnpublished: EventStats
    team: EventTeamStats
    review: EventCapReview
    matchDetailLinks: { match: EventMatch }
}

export type EventStatsSuccessFixtureName = keyof EventStatsSuccessFixtures

export type EventStatsErrorFixtureName = 'teamNotFound'

export type EventStatsFixtureName = EventStatsSuccessFixtureName | EventStatsErrorFixtureName

export interface EventStatsErrorBody {
    success: false
    error: string
}

interface FixtureEntry {
    file: string
    route: string
    status: number
    body: unknown
}

const OVERVIEW_ROUTE = 'GET /tournaments/:slug/stats'
const TEAM_ROUTE = 'GET /tournaments/:slug/teams/:teamId/stats'

export const EVENT_STATS_FIXTURES: Record<EventStatsFixtureName, FixtureEntry> = {
    overviewAll: { file: 'overview_all.json', route: OVERVIEW_ROUTE, status: 200, body: overviewAll },
    overviewStageEmpty: { file: 'overview_stage_empty.json', route: OVERVIEW_ROUTE, status: 200, body: overviewStageEmpty },
    overviewUnpublished: { file: 'overview_unpublished.json', route: OVERVIEW_ROUTE, status: 200, body: overviewUnpublished },
    team: { file: 'team.json', route: TEAM_ROUTE, status: 200, body: team },
    review: { file: 'review.json', route: 'GET /tournaments/:slug/admin/caps/review', status: 200, body: review },
    matchDetailLinks: {
        file: 'match_detail_links.json',
        route: 'GET /tournaments/:slug/matches/:matchId',
        status: 200,
        body: matchDetailLinks,
    },
    teamNotFound: { file: 'team_not_found.json', route: TEAM_ROUTE, status: 404, body: teamNotFound },
}

export function eventStatsFixture<K extends EventStatsSuccessFixtureName>(name: K): EventStatsSuccessFixtures[K] {
    const body = EVENT_STATS_FIXTURES[name].body as { data: EventStatsSuccessFixtures[K] }
    return structuredClone(body.data)
}

export function eventStatsErrorFixture(name: EventStatsErrorFixtureName): EventStatsErrorBody {
    return structuredClone(EVENT_STATS_FIXTURES[name].body as EventStatsErrorBody)
}

export function eventStatsFixtureResponse(name: EventStatsFixtureName): Response {
    return new Response(JSON.stringify(EVENT_STATS_FIXTURES[name].body), {
        status: EVENT_STATS_FIXTURES[name].status,
        headers: { 'Content-Type': 'application/json' },
    })
}
