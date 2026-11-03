import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { replyFor } from '../data'
import { recordedFixtureSet } from '../recording'
import type { FixtureRoute, FixtureSet } from '../types'
import { person, syntheticId } from './people'

const RECORDED = recordedFixtureSet('cap-detail')
const DONOR_ID = '258021df-51b1-4ed3-99cc-62d4e75892a7'
const RECORDED_RUNS = [DONOR_ID, '418b0aec-34c5-40e7-acf4-f2bc33373063', '8d742df9-2f14-4998-835c-3c16c1d1ee92']
const PLAYABLE_VIDEO = `data:video/webm;base64,${readFileSync(resolve(__dirname, '../../../next-map-flythrough.webm')).toString('base64')}`

export const EXTRA_RUN_IDS: readonly string[] = Array.from({ length: 5 }, (_, i) => `c0ffee0${i}-0000-4000-8000-00000000000${i}`)
export const EIGHT_RUN_IDS: readonly string[] = [...RECORDED_RUNS, ...EXTRA_RUN_IDS]

type Detail = { cap: Record<string, unknown>; checkpoints: { cumulative: number; segment: number }[] } & Record<string, unknown>

function donorDetail(): Detail {
    const reply = replyFor(RECORDED, new URL(`https://api.utbt.net/caps/${DONOR_ID}/detail`))
    return (reply?.json as { data: Detail }).data
}

function extraDetail(capId: string, i: number): FixtureRoute {
    const donor = donorDetail()
    const seconds = Number(donor.cap.cap_time_seconds) + 2 * (i + 1)
    const scale = seconds / Number(donor.cap.cap_time_seconds)
    const someone = person(40 + i)
    return {
        host: 'api',
        path: `/caps/${capId}/detail`,
        reply: {
            json: {
                success: true,
                data: {
                    ...donor,
                    cap: { ...donor.cap, id: capId, user: syntheticId(40 + i), alias: someone.alias, cap_time_seconds: seconds, active_title: null },
                    checkpoints: donor.checkpoints.map(checkpoint => ({ ...checkpoint, cumulative: checkpoint.cumulative * scale, segment: checkpoint.segment * scale })),
                    compare_candidates: [],
                    neighbors: { above: [], below: [] },
                },
            },
        },
    }
}

function playableReplay(capId: string): FixtureRoute {
    return {
        host: 'gateway',
        path: `/replays/${capId}`,
        reply: { json: { source: 'utrecorder', mp4_url: PLAYABLE_VIDEO, view_url: null, fps: 60 } },
    }
}

export const RUN_COMPARE_SET: FixtureSet = {
    name: 'run-compare',
    routes: [
        ...EIGHT_RUN_IDS.map(playableReplay),
        ...EXTRA_RUN_IDS.map(extraDetail),
        ...RECORDED.routes,
    ],
}
