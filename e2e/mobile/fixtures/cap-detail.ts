import type { CapDetail, LeaderboardEntry } from '../../../app/utils/api'
import { RUN_COMPARE_FIXTURES, runCompareFixture } from '../../../app/utils/fixtures/runCompareFixtures'
import { ok, type FixtureSet } from './types'

const RUNNER = runCompareFixture('capDetailCandidates')
const CANDIDATES = RUNNER.compare_candidates
const MEDIA_HOST = 'https://media.replays.test'

export const CAP_ID = RUNNER.cap.id
export const CAP_MAP = RUNNER.cap.map

function candidateDetail(candidateId: string): CapDetail | null {
    const candidate = CANDIDATES.find(entry => entry.id === candidateId)
    if (!candidate) return null
    return {
        ...RUNNER,
        cap: {
            ...RUNNER.cap,
            id: candidate.id,
            user: candidate.user,
            alias: candidate.alias,
            cap_time_seconds: candidate.cap_time_seconds,
            has_ghost: candidate.has_ghost,
            active_title: null,
        },
        checkpoints: RUNNER.wr_checkpoints,
        compare_candidates: [],
    }
}

function leaderboardEntry(id: string, user: string, alias: string | null, seconds: number): LeaderboardEntry {
    return { map: CAP_MAP, user, cap_time_seconds: seconds, added: '2026-09-01T12:00:00', alias: alias ?? '', cap_type: 0, verified: true, id, team: 0, active_title: null }
}

const LEADERBOARD: LeaderboardEntry[] = [
    leaderboardEntry(CAP_ID, String(RUNNER.cap.user), RUNNER.cap.alias ?? null, RUNNER.cap.cap_time_seconds),
    ...CANDIDATES.map(candidate => leaderboardEntry(candidate.id, candidate.user, candidate.alias, candidate.cap_time_seconds)),
].sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)

export const FIRST_RIVAL_ALIAS = LEADERBOARD.find(entry => entry.id !== CAP_ID)!.alias

export const capDetailFixtures: FixtureSet = {
    name: 'cap-detail',
    routes: [
        {
            host: 'api',
            path: /^\/caps\/[^/]+\/detail$/,
            reply: url => {
                const capId = decodeURIComponent(url.pathname.split('/')[2])
                const detail = capId === CAP_ID ? RUNNER : candidateDetail(capId)
                return detail ? ok(detail) : { status: 404, json: { success: false, error: 'Cap not found' } }
            },
        },
        { host: 'api', path: `/caps/leaderboard/map/${CAP_MAP}`, reply: ok(LEADERBOARD) },
        { host: 'api', path: '/ghosts/compare/motion', reply: { json: RUN_COMPARE_FIXTURES.motion.body } },
        { host: 'api', path: '/ghosts/compare', reply: { json: RUN_COMPARE_FIXTURES.aligned.body } },
        {
            host: 'gateway',
            path: /^\/replays\/[^/]+$/,
            reply: url => ({ json: { source: 'utrecorder', mp4_url: `${MEDIA_HOST}${url.pathname}.webm`, view_url: null, fps: 60 } }),
        },
    ],
}
