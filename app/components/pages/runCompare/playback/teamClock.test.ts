import { describe, expect, it } from 'vitest'
import type { CompareModel } from '../model/compareModel'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { comparisonKey } from '../loading/comparisons'
import { composeTeams, composeVersus, INDUSTRY, testTeam, versusOf } from '../model/teamTestRuns'
import { createPlaybackController, type PlaybackRun } from './playbackController'
import { createFakeTime, type FakeMedia } from './playbackFakes'
import { comparisonKnots, cueTargets, positionTarget, positionTargets } from './syncTargets'

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

    it('in sync by position, moves every member of a team by its driving pair\'s mapping', () => {
        const aligned = versusOf('teamAligned')
        const [fierd, nightwolf] = aligned.runner.members.map(run => run.capId)
        const [gxls, nettlez] = aligned.reference.members.map(run => run.capId)
        const short = runCompareFixture('short')
        const comparisons = new Map([
            [comparisonKey({ runner: fierd, reference: nettlez }), runCompareFixture('aligned')],
            [comparisonKey({ runner: nightwolf, reference: gxls }), short],
        ])
        const model = composeVersus(aligned, { comparisons }, `${aligned.query}&sync=position&drive=${nightwolf}`)
        const { time, controller, media } = setup(model)
        const mapping = positionTarget(comparisonKnots(short))
        expect(mapping.runTime(4)).not.toBeCloseTo(4, 2)

        controller.setTargets(positionTargets(model.sync.links))
        controller.seek(4)

        positionsOf(media, [fierd, nightwolf]).forEach(position => expect(position).toBeCloseTo(mapping.runTime(4), 9))
        positionsOf(media, [gxls, nettlez]).forEach(position => expect(position).toBeCloseTo(4, 9))

        controller.play()
        time.seconds(1.5)
        const [first, second] = positionsOf(media, [fierd, nightwolf])
        expect(first).toBeCloseTo(second, 9)
        expect(first).toBeCloseTo(mapping.runTime(controller.getState().t), 1)
    })
})
