import { describe, expect, it } from 'vitest'
import type { CompareModel } from '../model/compareModel'
import { composeTeams, INDUSTRY, testTeam } from '../model/teamTestRuns'
import { createPlaybackController, type PlaybackRun } from './playbackController'
import { createFakeTime, type FakeMedia } from './playbackFakes'
import { cueTargets } from './syncTargets'

const OTHER = testTeam(1, 70)
const MODEL = composeTeams(`runs=${INDUSTRY.teamCapId},${OTHER.teamCapId}`, [INDUSTRY, OTHER])

function setup(model: CompareModel) {
    const time = createFakeTime()
    const controller = createPlaybackController({ time })
    const media = new Map<string, FakeMedia>(model.race.runs.map(raceRun => [raceRun.run.capId, time.media({ duration: 90 })]))
    const runs = model.race.runs.map(({ run, cap, offset, fps, group }): PlaybackRun => ({ id: run.capId, group, cap, offset, fps, media: media.get(run.capId)! }))
    controller.setRuns(runs)
    return { time, controller, media }
}

function positionsOf(media: ReadonlyMap<string, FakeMedia>, capIds: readonly string[]): number[] {
    return capIds.map(capId => media.get(capId)!.position)
}

const INDUSTRY_POVS = INDUSTRY.members.map(run => run.capId)
const OTHER_POVS = OTHER.members.map(run => run.capId)

describe('a team run on one clock', () => {
    it('gives every member of a team run the same target in Race', () => {
        const { time, controller, media } = setup(MODEL)
        controller.seek(12.5)
        controller.play()
        time.seconds(2)

        const [first, ...rest] = positionsOf(media, INDUSTRY_POVS)
        expect(first).toBeGreaterThan(12.5)
        rest.forEach(position => expect(position).toBeCloseTo(first, 9))
        positionsOf(media, OTHER_POVS).forEach(position => expect(position).toBeCloseTo(first, 9))
    })

    it('cues each team run as a unit to its own crossing of the zone, and keeps teammates together while playing on', () => {
        const { time, controller, media } = setup(MODEL)
        const gate = MODEL.cues.points.find(point => point.label === 'Gate')!

        controller.cue(gate.key, gate.atMs / 1000, cueTargets(gate))

        positionsOf(media, INDUSTRY_POVS).forEach(position => expect(position).toBeCloseTo(9.871, 9))
        positionsOf(media, OTHER_POVS).forEach(position => expect(position).toBeCloseTo(11.5, 9))

        controller.play()
        time.seconds(1)
        const industry = positionsOf(media, INDUSTRY_POVS)
        const other = positionsOf(media, OTHER_POVS)
        industry.forEach(position => expect(position).toBeCloseTo(industry[0], 9))
        other.forEach(position => expect(position).toBeCloseTo(other[0], 9))
        expect(other[0] - industry[0]).toBeCloseTo(11.5 - 9.871, 6)
    })
})
