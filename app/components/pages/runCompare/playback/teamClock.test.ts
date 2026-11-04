import { describe, expect, it } from 'vitest'
import type { CompareModel } from '../model/compareModel'
import { composeTeams, composeVersus, INDUSTRY, testTeam, versusOf } from '../model/teamTestRuns'
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
const MIXED = versusOf('teamMixed')
const VERSUS = composeVersus(MIXED)
const REFERENCE_POVS = MIXED.reference.members.map(run => run.capId)

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

    it('cues each team run as a unit to its own team crossing of the zone, and keeps teammates together while playing on', () => {
        const { time, controller, media } = setup(VERSUS)
        const gate = VERSUS.cues.points.find(point => point.label === 'Gate')!

        controller.cue(gate.key, gate.atMs / 1000, cueTargets(gate))

        positionsOf(media, INDUSTRY_POVS).forEach(position => expect(position).toBeCloseTo(9.871, 9))
        positionsOf(media, REFERENCE_POVS).forEach(position => expect(position).toBeCloseTo(9.512, 9))

        controller.play()
        time.seconds(1)
        const industry = positionsOf(media, INDUSTRY_POVS)
        const reference = positionsOf(media, REFERENCE_POVS)
        industry.forEach(position => expect(position).toBeCloseTo(industry[0], 9))
        reference.forEach(position => expect(position).toBeCloseTo(reference[0], 9))
        expect(industry[0] - reference[0]).toBeCloseTo(9.871 - 9.512, 6)
    })

    it('cues both teams from a different route card, each to its member\'s own crossing', () => {
        const { controller, media } = setup(VERSUS)
        const crane = VERSUS.teamAnalysis.routes[0].anchors.find(anchor => anchor.label === 'Crane')!.cue!

        controller.cue(crane.key, crane.atMs / 1000, cueTargets(crane))

        positionsOf(media, INDUSTRY_POVS).forEach(position => expect(position).toBeCloseTo(27.402, 9))
        positionsOf(media, REFERENCE_POVS).forEach(position => expect(position).toBeCloseTo(26.94, 9))
    })
})
