import adminMatch from './streamSides/admin_match.json'
import bettingClosed from './streamSides/betting_closed.json'
import desk from './streamSides/desk.json'
import errorInvalidSide from './streamSides/error_invalid_side.json'
import errorPickBanInProgress from './streamSides/error_pick_ban_in_progress.json'
import errorSideNotOpen from './streamSides/error_side_not_open.json'
import leaderboard from './streamSides/leaderboard.json'
import meMatches from './streamSides/me_matches.json'
import pickBanAdminSet from './streamSides/pick_ban_admin_set.json'
import pickBanLobby from './streamSides/pick_ban_lobby.json'
import pickBanLobbyUndetermined from './streamSides/pick_ban_lobby_undetermined.json'
import pickBanSideChoice from './streamSides/pick_ban_side_choice.json'
import pickBanSideSpotlight from './streamSides/pick_ban_side_spotlight.json'
import predictorStandings from './streamSides/predictor_standings.json'
import predictorStandingsMatchless from './streamSides/predictor_standings_matchless.json'
import streamSidesPut from './streamSides/stream_sides_put.json'
import streamState from './streamSides/stream_state.json'
import type {
    EventMatch,
    MatchSides,
    MatchSidesErrorCode,
    MyMatchEntry,
    PickBanContractPhase,
    PickBanErrorCode,
    PickBanSideErrorCode,
    PickBanState,
    PredictionLeaderboard,
} from '@/app/utils/api'
import type { StreamDesk } from '@/app/components/pages/events/stream/streamDesk'
import type { StreamHotState } from '@/app/components/stream/data/streamHotState'
import type { BettingBacker, BettingRead, BettingSide } from '@/app/components/stream/scenes/betting/bettingRead'
import type { PredictorStandings } from '@/app/components/stream/scenes/standings/predictorStandingsRead'

export type ContractPickBanState = Omit<PickBanState, 'phase'> & {
    phase: PickBanContractPhase | null
}

export type ContractBettingBacker = Omit<BettingBacker, 'multiplier'> & { multiplier: number | null }

export type ContractBettingSide = Omit<BettingSide, 'odds' | 'backers'> & {
    odds: number | null
    backers: ContractBettingBacker[]
}

export type ContractBettingRead = Omit<BettingRead, 'leaderboard' | 'sides'> & {
    sides: { a: ContractBettingSide; b: ContractBettingSide; draw: ContractBettingSide | null } | null
}

export interface StreamSidesSuccessFixtures {
    pickBanLobby: ContractPickBanState
    pickBanLobbyUndetermined: ContractPickBanState
    pickBanSideChoice: ContractPickBanState
    pickBanSideSpotlight: ContractPickBanState
    pickBanAdminSet: ContractPickBanState
    streamState: StreamHotState
    desk: StreamDesk
    streamSidesPut: MatchSides
    meMatches: { items: MyMatchEntry[] }
    adminMatch: { match: EventMatch }
    predictorStandings: PredictorStandings
    predictorStandingsMatchless: PredictorStandings
    leaderboard: PredictionLeaderboard
    bettingClosed: ContractBettingRead
}

export type StreamSidesSuccessFixtureName = keyof StreamSidesSuccessFixtures

export type StreamSidesErrorFixtureName = 'errorPickBanInProgress' | 'errorInvalidSide' | 'errorSideNotOpen'

export type StreamSidesFixtureName = StreamSidesSuccessFixtureName | StreamSidesErrorFixtureName

export interface StreamSidesErrorBody {
    success: false
    error: string
    code: MatchSidesErrorCode | PickBanErrorCode | PickBanSideErrorCode
}

interface FixtureEntry {
    file: string
    route: string
    status: number
    body: unknown
}

const PICK_BAN_STATE_ROUTE = 'GET /tournaments/:slug/matches/:matchId/pick-ban'
const PICK_BAN_SIDE_ROUTE = 'POST /tournaments/:slug/matches/:matchId/pick-ban/side'
const STREAM_SIDES_ROUTE = 'PUT /tournaments/:slug/stream/matches/:matchId/sides'

export const STREAM_SIDES_FIXTURES: Record<StreamSidesFixtureName, FixtureEntry> = {
    pickBanLobby: { file: 'pick_ban_lobby.json', route: PICK_BAN_STATE_ROUTE, status: 200, body: pickBanLobby },
    pickBanLobbyUndetermined: {
        file: 'pick_ban_lobby_undetermined.json',
        route: PICK_BAN_STATE_ROUTE,
        status: 200,
        body: pickBanLobbyUndetermined,
    },
    pickBanSideChoice: {
        file: 'pick_ban_side_choice.json',
        route: PICK_BAN_STATE_ROUTE,
        status: 200,
        body: pickBanSideChoice,
    },
    pickBanSideSpotlight: {
        file: 'pick_ban_side_spotlight.json',
        route: PICK_BAN_SIDE_ROUTE,
        status: 200,
        body: pickBanSideSpotlight,
    },
    pickBanAdminSet: { file: 'pick_ban_admin_set.json', route: PICK_BAN_STATE_ROUTE, status: 200, body: pickBanAdminSet },
    streamState: {
        file: 'stream_state.json',
        route: 'GET /tournaments/:slug/stream/:streamerId/state',
        status: 200,
        body: streamState,
    },
    desk: { file: 'desk.json', route: 'GET /tournaments/:slug/stream/:streamerId/desk', status: 200, body: desk },
    streamSidesPut: { file: 'stream_sides_put.json', route: STREAM_SIDES_ROUTE, status: 200, body: streamSidesPut },
    meMatches: { file: 'me_matches.json', route: 'GET /tournaments/:slug/me/matches', status: 200, body: meMatches },
    adminMatch: {
        file: 'admin_match.json',
        route: 'PATCH /tournaments/:slug/admin/matches/:matchId',
        status: 200,
        body: adminMatch,
    },
    predictorStandings: {
        file: 'predictor_standings.json',
        route: 'GET /tournaments/:slug/stream/matches/:matchId/predictor-standings',
        status: 200,
        body: predictorStandings,
    },
    predictorStandingsMatchless: {
        file: 'predictor_standings_matchless.json',
        route: 'GET /tournaments/:slug/stream/predictor-standings',
        status: 200,
        body: predictorStandingsMatchless,
    },
    leaderboard: {
        file: 'leaderboard.json',
        route: 'GET /tournaments/:slug/predictions/leaderboard',
        status: 200,
        body: leaderboard,
    },
    bettingClosed: {
        file: 'betting_closed.json',
        route: 'GET /tournaments/:slug/stream/matches/:matchId/betting',
        status: 200,
        body: bettingClosed,
    },
    errorPickBanInProgress: {
        file: 'error_pick_ban_in_progress.json',
        route: STREAM_SIDES_ROUTE,
        status: 409,
        body: errorPickBanInProgress,
    },
    errorInvalidSide: { file: 'error_invalid_side.json', route: STREAM_SIDES_ROUTE, status: 400, body: errorInvalidSide },
    errorSideNotOpen: { file: 'error_side_not_open.json', route: PICK_BAN_SIDE_ROUTE, status: 409, body: errorSideNotOpen },
}

export function streamSidesFixture<K extends StreamSidesSuccessFixtureName>(name: K): StreamSidesSuccessFixtures[K] {
    const body = STREAM_SIDES_FIXTURES[name].body as { data: StreamSidesSuccessFixtures[K] }
    return structuredClone(body.data)
}

export function streamSidesErrorFixture(name: StreamSidesErrorFixtureName): StreamSidesErrorBody {
    return structuredClone(STREAM_SIDES_FIXTURES[name].body as StreamSidesErrorBody)
}

export function streamSidesFixtureResponse(name: StreamSidesFixtureName): Response {
    return new Response(JSON.stringify(STREAM_SIDES_FIXTURES[name].body), {
        status: STREAM_SIDES_FIXTURES[name].status,
        headers: { 'Content-Type': 'application/json' },
    })
}
