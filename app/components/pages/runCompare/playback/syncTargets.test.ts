import { describe, expect, it } from 'vitest'
import { createPlaybackController, type PlaybackRun } from './playbackController'
import { createFakeTime, type FakeMedia } from './playbackFakes'
import { comparisonKnots, cueTargets, positionTarget, positionTargets, type PositionKnot } from './syncTargets'

function video(id: string, media: FakeMedia, extra: Partial<PlaybackRun> = {}): PlaybackRun {
    return { id, cap: 20, fps: 60, media, ...extra }
}

function setup() {
    const time = createFakeTime()
    const controller = createPlaybackController({ time })
    return { time, controller }
}

function perSideCue() {
    return {
        atMs: 3549,
        runTimesMs: new Map([
            ['red', 3549],
            ['redRunner', 3740],
            ['blue', 3600],
            ['blueRunner', 3300],
        ]),
    }
}

function perSideSet(time: ReturnType<typeof createFakeTime>) {
    const media = {
        red: time.media(),
        redRunner: time.media(),
        blue: time.media(),
        blueRunner: time.media(),
        timeOnly: time.media(),
    }
    const runs = Object.entries(media).map(([id, fake]) => video(id, fake))
    return { media, runs }
}

describe('a sector cue', () => {
    it('puts every run on each side at its own entry into the sector, and the rest on the race clock', () => {
        const { time, controller } = setup()
        const { media, runs } = perSideSet(time)
        controller.setRuns(runs)

        controller.cue('S4', 3.549, cueTargets(perSideCue()))

        expect(controller.getState()).toMatchObject({ t: 3.549, cue: 'S4' })
        const expected = { red: 3.549, redRunner: 3.74, blue: 3.6, blueRunner: 3.3, timeOnly: 3.549 }
        Object.entries(expected).forEach(([id, seconds]) => {
            const fake = media[id as keyof typeof media]
            expect(fake.seeks()).toHaveLength(1)
            expect(fake.position).toBeCloseTo(seconds, 9)
            expect(controller.getState().runTimes[id]).toBeCloseTo(seconds, 9)
        })
    })

    it('plays every run on from its own entry', () => {
        const { time, controller } = setup()
        const { media, runs } = perSideSet(time)
        controller.setRuns(runs)
        controller.cue('S4', 3.549, cueTargets(perSideCue()))

        controller.play()
        time.seconds(2)

        const { t } = controller.getState()
        expect(t).toBeGreaterThan(5.4)
        expect(media.red.position).toBeCloseTo(t, 6)
        expect(media.redRunner.position).toBeCloseTo(t + 0.191, 6)
        expect(media.blue.position).toBeCloseTo(t + 0.051, 6)
        expect(media.blueRunner.position).toBeCloseTo(t - 0.249, 6)
        expect(media.timeOnly.position).toBeCloseTo(t, 6)
        expect(controller.getState().cue).toBe('S4')
    })

    it('is cleared by a scrub, which puts every run back on the race clock', () => {
        const { time, controller } = setup()
        const { media, runs } = perSideSet(time)
        controller.setRuns(runs)
        controller.cue('S4', 3.549, cueTargets(perSideCue()))

        controller.beginScrub()
        controller.seek(8)
        controller.endScrub()

        expect(controller.getState().cue).toBeNull()
        Object.values(media).forEach(fake => expect(fake.position).toBe(8))
    })

    it('is cleared by a seek and by a skip, and kept through a frame step', () => {
        const { time, controller } = setup()
        const { media, runs } = perSideSet(time)
        controller.setRuns(runs)

        controller.cue('S4', 3.549, cueTargets(perSideCue()))
        controller.stepFrame(1)
        expect(controller.getState().cue).toBe('S4')
        expect(media.redRunner.position).toBeCloseTo(3.549 + 1 / 60 + 0.191, 6)

        controller.skip(1)
        expect(controller.getState().cue).toBeNull()
        expect(media.redRunner.position).toBeCloseTo(controller.getState().t, 6)

        controller.cue('S4', 3.549, cueTargets(perSideCue()))
        controller.seek(2)
        expect(controller.getState().cue).toBeNull()
        expect(media.blue.position).toBe(2)
    })

    it('is cleared on its own, leaving the playhead where it is', () => {
        const { time, controller } = setup()
        const { media, runs } = perSideSet(time)
        controller.setRuns(runs)
        controller.cue('S4', 3.549, cueTargets(perSideCue()))

        controller.clearCue()

        expect(controller.getState()).toMatchObject({ t: 3.549, cue: null })
        expect(media.redRunner.position).toBe(3.549)
        expect(media.red.seeks()).toEqual([3.549])
    })

    it('keeps the base target of a group it does not list', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const follower = time.media()
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.setTargets(new Map([['follower', positionTarget([[0, 0], [10_000, 2000]])]]))

        controller.cue('S2', 2, cueTargets({ atMs: 2000, runTimesMs: new Map([['reference', 2000]]) }))

        expect(follower.position).toBeCloseTo(2.4, 6)
    })
})

const STEADY: PositionKnot[] = [[0, 0], [4000, 2000], [5000, 4000], [9000, 1000], [20_000, 1000]]

describe('sync by position', () => {
    it('plays a follower at the slope of its mapping, within half and double the global rate', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const follower = time.media()
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: STEADY }]))
        expect(follower.position).toBe(0)

        controller.play()
        time.seconds(2)
        expect(follower.rate).toBeCloseTo(1.5, 2)
        expect(follower.position).toBeCloseTo(controller.getState().t * 1.5, 2)
        expect(follower.seeks()).toEqual([])

        time.seconds(2.5)
        expect(follower.rate).toBe(2)

        controller.seek(6)
        controller.play()
        time.seconds(1)
        expect(follower.rate).toBe(0.5)
        expect(reference.rate).toBe(1)
    })

    it('scales the follower\'s rate with the global rate', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const follower = time.media()
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: STEADY }]))

        controller.setRate(2)
        controller.play()
        time.seconds(1)

        expect(reference.rate).toBe(2)
        expect(follower.rate).toBeCloseTo(3, 2)
        expect(follower.position).toBeCloseTo(controller.getState().t * 1.5, 2)
    })

    it('re-seeks a follower that falls more than a quarter second behind, and only nudges its rate below that', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const follower = time.media()
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: STEADY }]))
        controller.play()
        time.seconds(1)

        follower.drift(-0.2)
        time.frames(1)
        expect(follower.seeks()).toEqual([])
        expect(follower.rate).toBeGreaterThan(1.6)
        expect(reference.playing).toBe(true)

        time.seconds(2)
        expect(follower.position).toBeCloseTo(controller.getState().t * 1.5, 1)

        follower.drift(-0.3)
        time.frames(1)
        expect(follower.seeks()).toHaveLength(1)
        expect(follower.seeks()[0]).toBeCloseTo(controller.getState().t * 1.5, 6)
    })

    it('gives every member of a group one target, each with its own offset', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const first = time.media()
        const second = time.media()
        controller.setRuns([
            video('reference', reference),
            video('first', first, { group: 'team' }),
            video('second', second, { group: 'team', offset: 0.25 }),
        ])
        controller.setTargets(positionTargets([{ capId: 'team', reference: 'reference', knots: STEADY }]))

        controller.play()
        time.seconds(3)

        const { t, runTimes } = controller.getState()
        expect(runTimes.first).toBeCloseTo(t * 1.5, 9)
        expect(runTimes.second).toBe(runTimes.first)
        expect(second.position - first.position).toBeCloseTo(0.25, 6)
        expect(second.rate).toBe(first.rate)
        expect(first.rate).toBeCloseTo(1.5, 2)
    })

    it('starts a slow follower without moving the clock off the reference', () => {
        const { time, controller } = setup()
        const reference = time.media({ startDelayMs: 80 })
        const follower = time.media({ startDelayMs: 80 })
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: [[0, 0], [20_000, -8000]] }]))

        controller.play()
        time.seconds(2)

        expect(reference.seeks()).toEqual([])
        expect(follower.seeks()).toEqual([])
        expect(reference.position).toBeCloseTo(controller.getState().t, 2)
        expect(follower.rate).toBeCloseTo(0.6, 2)
    })

    it('follows the straight connector across a separation band', () => {
        const { controller } = setup()
        controller.setRuns([{ id: 'reference', cap: 20, media: null }, { id: 'follower', cap: 20, media: null }])
        const knots = comparisonKnots({
            segments: [[[0, 0], [2000, 100]], [[6000, 900], [8000, 900]]],
            separations: [{ start_ms: 2000, end_ms: 6000, start_delta_ms: 100, end_delta_ms: 900, rejoined: true }],
        })
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots }]))

        controller.seek(4)
        expect(controller.getState().runTimes.follower).toBeCloseTo(4.5, 9)
        controller.seek(7)
        expect(controller.getState().runTimes.follower).toBeCloseTo(7.9, 9)
    })

    it('jumps across a separation of zero width', () => {
        const { controller } = setup()
        controller.setRuns([{ id: 'reference', cap: 20, media: null }, { id: 'follower', cap: 20, media: null }])
        const knots = comparisonKnots({
            segments: [[[0, 0], [2000, 0]], [[2000, 1500], [4000, 1500]]],
            separations: [{ start_ms: 2000, end_ms: 2000, start_delta_ms: 0, end_delta_ms: 1500, rejoined: true }],
        })
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots }]))

        controller.seek(1.9)
        expect(controller.getState().runTimes.follower).toBeCloseTo(1.9, 9)
        controller.seek(2.1)
        expect(controller.getState().runTimes.follower).toBeCloseTo(3.6, 9)
    })

    it('runs the timeline until a follower reaches its own cap on the reference\'s clock', () => {
        const { controller } = setup()
        controller.setRuns([{ id: 'reference', cap: 10, media: null }, { id: 'follower', cap: 9, media: null }])

        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: [[0, 0], [20_000, -4000]] }]))

        expect(controller.getState().end).toBeCloseTo(11.25, 9)
        controller.seek(11)
        expect(controller.getState().frozen).toEqual(['reference'])
        controller.seek(11.25)
        expect(controller.getState().frozen).toEqual(['reference', 'follower'])
    })

    it('goes back to the race clock and the global rate when the targets are cleared', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const follower = time.media()
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: STEADY }]))
        controller.play()
        time.seconds(2)

        controller.setTargets(new Map())
        time.seconds(1)

        expect(follower.rate).toBe(1)
        expect(follower.position).toBeCloseTo(controller.getState().t, 6)
    })

    it('clears a cue when the mode changes', () => {
        const { time, controller } = setup()
        const reference = time.media()
        const follower = time.media()
        controller.setRuns([video('reference', reference), video('follower', follower)])
        controller.cue('S2', 2, cueTargets({ atMs: 2000, runTimesMs: new Map([['reference', 2000], ['follower', 2600]]) }))

        controller.setTargets(positionTargets([{ capId: 'follower', reference: 'reference', knots: STEADY }]), { clearCue: true })

        expect(controller.getState().cue).toBeNull()
        expect(follower.seeks()).toEqual([2.6, 3])
    })
})

describe('a cue in sync by position', () => {
    it('moves a follower with its side reference\'s own entry', () => {
        const { time, controller } = setup()
        const lead = time.media()
        const blue = time.media()
        const blueFollower = time.media()
        controller.setRuns([video('lead', lead), video('blue', blue), video('blueFollower', blueFollower)])
        const links = [{ capId: 'blueFollower', reference: 'blue', knots: [[0, 0], [20_000, 10_000]] as PositionKnot[] }]
        controller.setTargets(positionTargets(links))

        controller.cue('S2', 2, cueTargets({ atMs: 2000, runTimesMs: new Map([['lead', 2000], ['blue', 2200], ['blueFollower', 3500]]) }, links))

        expect(blue.position).toBeCloseTo(2.2, 6)
        expect(blueFollower.position).toBeCloseTo(3.3, 6)
        expect(lead.position).toBeCloseTo(2, 6)
    })
})
