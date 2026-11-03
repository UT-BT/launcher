import { describe, expect, it } from 'vitest'
import { createPlaybackController, type PlaybackRun } from './playbackController'
import { createFakeTime, type FakeMedia } from './playbackFakes'

function video(id: string, media: FakeMedia, extra: Partial<PlaybackRun> = {}): PlaybackRun {
    return { id, cap: 60, fps: 60, media, ...extra }
}

function dataOnly(id: string, extra: Partial<PlaybackRun> = {}): PlaybackRun {
    return { id, cap: 60, media: null, ...extra }
}

function setup() {
    const time = createFakeTime()
    const controller = createPlaybackController({ time })
    return { time, controller }
}

describe('starting playback', () => {
    it('waits until every visible video can play, then starts them together', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media({ ready: false })
        controller.setRuns([video('a', a), video('b', b)])

        controller.play()
        time.frames(10)

        expect(a.playing).toBe(false)
        expect(b.playing).toBe(false)
        expect(controller.getState()).toMatchObject({ playing: true, t: 0, stalled: ['b'] })

        b.recover()

        expect(a.playing).toBe(true)
        expect(b.playing).toBe(true)
        expect(controller.getState().stalled).toEqual([])
        time.seconds(1)
        expect(controller.getState().t).toBeCloseTo(1, 2)
        expect(a.position).toBeCloseTo(1, 2)
        expect(b.position).toBeCloseTo(1, 2)
    })

    it('never waits for a data-only run', () => {
        const { time, controller } = setup()
        const a = time.media()
        controller.setRuns([video('a', a), dataOnly('lane')])

        controller.play()
        time.seconds(2)

        expect(a.playing).toBe(true)
        expect(controller.getState().t).toBeCloseTo(2, 2)
        expect(controller.getState().runTimes.lane).toBeCloseTo(2, 2)
    })

    it('runs the clock on its own when every run is data-only', () => {
        const { time, controller } = setup()
        controller.setRuns([dataOnly('x', { cap: 30 }), dataOnly('y', { cap: 40 })])

        controller.play()
        time.seconds(3)

        expect(controller.getState()).toMatchObject({ playing: true, stalled: [] })
        expect(controller.getState().t).toBeCloseTo(3, 2)
    })

    it('holds the clock until the videos start moving, so a slow start is never re-seeked', () => {
        const { time, controller } = setup()
        const a = time.media({ startDelayMs: 80 })
        const b = time.media({ startDelayMs: 80 })
        controller.setRuns([video('a', a), video('b', b)])

        controller.play()
        time.frames(3)
        expect(controller.getState().t).toBe(0)

        time.seconds(1)

        expect(a.seeks()).toEqual([])
        expect(b.seeks()).toEqual([])
        expect(controller.getState().t).toBeCloseTo(a.position, 3)
    })

    it('pins the clock for at most a second when a video never starts moving', () => {
        const { time, controller } = setup()
        const stuck = time.media({ startDelayMs: 60_000 })
        const b = time.media()
        controller.setRuns([video('stuck', stuck), video('b', b)])

        controller.play()
        time.seconds(0.9)
        expect(controller.getState().t).toBe(0)

        time.seconds(0.2)
        expect(controller.getState().t).toBeGreaterThan(0.9)
    })
})

describe('the stall hold', () => {
    it('pauses every visible video while one is waiting and keeps the clock still', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        const c = time.media()
        controller.setRuns([video('a', a), video('b', b), video('c', c)])
        controller.play()
        time.seconds(1)

        b.stall()
        const heldAt = controller.getState().t
        time.seconds(2)

        expect([a.playing, b.playing, c.playing]).toEqual([false, false, false])
        expect(controller.getState()).toMatchObject({ playing: true, stalled: ['b'], t: heldAt })
    })

    it('resumes every video together once each one can play again', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        controller.setRuns([video('a', a), video('b', b)])
        controller.play()
        time.seconds(1)
        a.stall()
        b.stall()
        time.seconds(1)

        a.recover()
        expect([a.playing, b.playing]).toEqual([false, false])

        b.recover()
        expect([a.playing, b.playing]).toEqual([true, true])
        time.seconds(1)
        expect(controller.getState().t).toBeCloseTo(2, 2)
        expect(controller.getState().stalled).toEqual([])
    })

    it('holds while a visible video is seeking', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media({ seekFrames: Number.POSITIVE_INFINITY })
        controller.setRuns([video('a', a), video('b', b)])
        controller.play()
        time.seconds(1)

        b.seek(b.position)
        time.seconds(1)
        expect(controller.getState()).toMatchObject({ stalled: ['b'] })
        expect(a.playing).toBe(false)

        b.finishSeek()
        expect([a.playing, b.playing]).toEqual([true, true])
    })
})

describe('drift correction in Race', () => {
    it('re-seeks a video more than one frame off its target, and only that video', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        controller.setRuns([video('a', a), video('b', b)])
        controller.play()
        time.seconds(1)

        b.drift(0.03)
        time.frames(1)

        expect(a.seeks()).toEqual([])
        expect(b.seeks()).toHaveLength(1)
        expect(b.seeks()[0]).toBeCloseTo(controller.getState().t, 6)
        time.seconds(1)
        expect(b.position).toBeCloseTo(controller.getState().t, 6)
        expect(a.position).toBeCloseTo(controller.getState().t, 6)
    })

    it('leaves a video less than one frame off alone', () => {
        const { time, controller } = setup()
        const a = time.media()
        controller.setRuns([video('a', a)])
        controller.play()
        time.seconds(1)

        a.drift(-0.012)
        time.seconds(1)

        expect(a.seeks()).toEqual([])
        expect(a.playing).toBe(true)
    })

    it('takes the frame from each video\'s own fps, 30 when unknown', () => {
        const { time, controller } = setup()
        const at60 = time.media()
        const at30 = time.media()
        const unknown = time.media()
        controller.setRuns([
            video('at60', at60, { fps: 60 }),
            video('at30', at30, { fps: 30 }),
            video('unknown', unknown, { fps: null }),
        ])
        controller.play()
        time.seconds(1)

        at60.drift(0.025)
        at30.drift(0.025)
        unknown.drift(0.025)
        time.frames(1)

        expect(at60.seeks()).toHaveLength(1)
        expect(at30.seeks()).toEqual([])
        expect(unknown.seeks()).toEqual([])
    })

    it('re-seeks a video that runs past its cap frame ahead of its target', () => {
        const { time, controller } = setup()
        const a = time.media()
        const ahead = time.media()
        controller.setRuns([video('a', a, { cap: 4 }), video('ahead', ahead, { cap: 2 })])
        controller.play()
        time.seconds(1.5)

        ahead.drift(0.6)
        time.frames(1)

        expect(ahead.seeks()).toHaveLength(1)
        expect(ahead.seeks()[0]).toBeCloseTo(controller.getState().t, 6)
        time.seconds(0.25)
        expect(ahead.position).toBeCloseTo(controller.getState().t, 6)
        expect(a.position).toBeCloseTo(controller.getState().t, 6)
    })
})

describe('freeze at cap', () => {
    it('stops each video on its own cap frame and reports it frozen while the others play on', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        controller.setRuns([video('a', a, { cap: 2 }), video('b', b, { cap: 4 })])
        controller.play()

        time.seconds(2.5)

        expect(a.playing).toBe(false)
        expect(a.position).toBeCloseTo(2, 3)
        expect(b.playing).toBe(true)
        expect(controller.getState().frozen).toEqual(['a'])
        expect(controller.getState().runTimes).toEqual({ a: 2, b: expect.closeTo(2.5, 2) })
    })

    it('runs the timeline to the slowest cap and stops there with every run frozen', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        controller.setRuns([video('a', a, { cap: 2 }), video('b', b, { cap: 3 }), dataOnly('lane', { cap: 4 })])
        expect(controller.getState().end).toBe(4)

        controller.play()
        time.seconds(5)

        expect(controller.getState()).toMatchObject({ playing: false, t: 4, frozen: ['a', 'b', 'lane'] })
        expect(a.position).toBeCloseTo(2, 3)
        expect(b.position).toBeCloseTo(3, 3)
    })

    it('never holds playback for a frozen video', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        controller.setRuns([video('a', a, { cap: 1 }), video('b', b, { cap: 4 })])
        controller.play()
        time.seconds(1.5)

        a.stall()
        time.seconds(1)

        expect(controller.getState().stalled).toEqual([])
        expect(b.playing).toBe(true)
        expect(controller.getState().t).toBeCloseTo(2.5, 2)
    })

    it('freezes a video that ends before its cap on its last frame without holding anyone', () => {
        const { time, controller } = setup()
        const short = time.media({ duration: 1.5 })
        const b = time.media()
        controller.setRuns([video('short', short, { cap: 2 }), video('b', b, { cap: 4 })])
        controller.play()
        time.seconds(1.75)

        short.stall()
        time.seconds(0.5)

        expect(short.playing).toBe(false)
        expect(short.position).toBeCloseTo(1.5, 3)
        expect(b.playing).toBe(true)
        expect(controller.getState().frozen).toEqual(['short'])
    })

    it('never holds playback for a video sitting on its last frame just before the clock gets there', () => {
        const { time, controller } = setup()
        const short = time.media({ duration: 1.5 })
        const b = time.media()
        controller.setRuns([video('short', short, { cap: 2, fps: 30 }), video('b', b, { cap: 4 })])
        controller.play()
        time.frames(89)

        short.drift(0.02)
        short.stall()
        time.frames(3)

        expect(short.position).toBe(1.5)
        expect(controller.getState().stalled).toEqual([])
        expect(b.playing).toBe(true)
        expect(controller.getState().t).toBeGreaterThan(1.5)
    })

    it('plays again from the start once the timeline has ended', () => {
        const { time, controller } = setup()
        const a = time.media()
        controller.setRuns([video('a', a, { cap: 1 })])
        controller.play()
        time.seconds(2)

        controller.play()
        time.seconds(0.5)

        expect(a.seeks().at(-1)).toBe(0)
        expect(controller.getState()).toMatchObject({ playing: true, frozen: [] })
        expect(controller.getState().t).toBeGreaterThan(0.4)
        expect(a.position).toBeCloseTo(controller.getState().t, 6)
    })
})

describe('the offset of a video that is not frame-synced', () => {
    it('shifts that video\'s targets and its cap frame, and leaves its run time and the timeline alone', () => {
        const { time, controller } = setup()
        const a = time.media()
        const late = time.media()
        controller.setRuns([video('a', a, { cap: 3 }), video('late', late, { cap: 2, offset: 1.5 })])

        expect(late.seeks()).toEqual([1.5])
        controller.play()
        time.seconds(1)
        const { t, runTimes } = controller.getState()
        expect(late.position).toBeCloseTo(t + 1.5, 6)
        expect(runTimes.late).toBeCloseTo(t, 6)
        expect(a.position).toBeCloseTo(t, 6)

        time.seconds(1.5)
        expect(late.playing).toBe(false)
        expect(late.position).toBeCloseTo(3.5, 3)
        expect(controller.getState().frozen).toEqual(['late'])
        expect(controller.getState().end).toBe(3)
    })

    it('holds a video with a negative offset on its first frame until its run starts', () => {
        const { time, controller } = setup()
        const a = time.media()
        const early = time.media()
        controller.setRuns([video('a', a), video('early', early, { offset: -0.5 })])
        controller.play()

        time.seconds(0.25)
        expect(early.playing).toBe(false)
        expect(early.position).toBe(0)
        expect(a.playing).toBe(true)

        time.seconds(1)
        expect(early.playing).toBe(true)
        expect(early.position).toBeCloseTo(controller.getState().t - 0.5, 1)
    })
})

describe('the transport', () => {
    it('seeks every visible video to its target, clamped to the timeline', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media()
        controller.setRuns([video('a', a, { cap: 20 }), video('b', b, { cap: 30, offset: 0.5 })])

        controller.seek(12.5)
        expect(controller.getState().t).toBe(12.5)
        expect(a.seeks()).toEqual([12.5])
        expect(b.seeks()).toEqual([0.5, 13])

        controller.seek(99)
        expect(controller.getState().t).toBe(30)
        controller.seek(-3)
        expect(controller.getState().t).toBe(0)
    })

    it('ignores a seek to a time that is not a number', () => {
        const { time, controller } = setup()
        const a = time.media()
        controller.setRuns([video('a', a, { cap: 20 })])
        controller.seek(5)

        controller.seek(Number.NaN)
        controller.seek(Number.POSITIVE_INFINITY)

        expect(controller.getState().t).toBe(5)
        expect(a.seeks()).toEqual([5])
        controller.play()
        time.seconds(1)
        expect(controller.getState().t).toBeCloseTo(6, 1)
        expect(a.position).toBeCloseTo(controller.getState().t, 6)
    })

    it('holds play through a scrub until every visible video has seeked', () => {
        const { time, controller } = setup()
        const a = time.media()
        const b = time.media({ seekFrames: Number.POSITIVE_INFINITY })
        controller.setRuns([video('a', a), video('b', b)])
        controller.play()
        time.seconds(1)

        controller.beginScrub()
        expect([a.playing, b.playing]).toEqual([false, false])
        controller.seek(10)
        controller.seek(12)
        time.frames(5)
        controller.endScrub()
        time.frames(5)

        expect(controller.getState()).toMatchObject({ playing: true, t: 12, stalled: ['b'] })
        expect(a.playing).toBe(false)

        b.finishSeek()
        expect([a.playing, b.playing]).toEqual([true, true])
        expect(a.position).toBe(12)
        expect(b.position).toBe(12)
    })

    it('steps one frame at the lowest fps among visible videos and pauses', () => {
        const { time, controller } = setup()
        const at60 = time.media()
        const at50 = time.media()
        const hidden = time.media()
        controller.setRuns([
            video('at60', at60, { fps: 60 }),
            video('at50', at50, { fps: 50 }),
            video('hidden', hidden, { fps: 24, hidden: true }),
            dataOnly('lane', { fps: 10 }),
        ])
        controller.seek(1)
        controller.play()
        time.frames(2)

        controller.pause()
        controller.seek(1)
        controller.stepFrame(1)
        expect(controller.getState().playing).toBe(false)
        expect(controller.getState().t).toBeCloseTo(1.02, 9)

        controller.play()
        controller.stepFrame(-1)
        expect(controller.getState()).toMatchObject({ playing: false })
        expect(controller.getState().t).toBeCloseTo(1, 9)
        expect(at60.seeks().at(-1)).toBeCloseTo(1, 9)
    })

    it('steps at 30 fps when a visible video\'s fps is unknown, and stops at zero', () => {
        const { time, controller } = setup()
        const known = time.media()
        const unknown = time.media()
        controller.setRuns([video('known', known, { fps: 60 }), video('unknown', unknown, { fps: null })])

        controller.seek(0.5)
        controller.stepFrame(1)
        expect(controller.getState().t).toBeCloseTo(0.5 + 1 / 30, 9)

        controller.seek(0.01)
        controller.stepFrame(-1)
        expect(controller.getState().t).toBe(0)
    })

    it('skips five seconds back and forth, clamped to the timeline, and keeps playing', () => {
        const { time, controller } = setup()
        const a = time.media()
        controller.setRuns([video('a', a, { cap: 12 })])
        controller.seek(2)

        controller.skip(1)
        expect(controller.getState().t).toBe(7)
        controller.skip(1)
        controller.skip(1)
        expect(controller.getState().t).toBe(12)
        controller.seek(3)
        controller.skip(-1)
        expect(controller.getState().t).toBe(0)

        controller.play()
        time.seconds(0.5)
        controller.skip(1)
        time.seconds(0.5)
        expect(controller.getState().playing).toBe(true)
        expect(a.playing).toBe(true)
        expect(controller.getState().t).toBeGreaterThan(5.4)
    })

    it('applies one rate to every video and the clock, within a quarter and double speed', () => {
        const { time, controller } = setup()
        const a = time.media()
        const hidden = time.media()
        controller.setRuns([video('a', a), video('hidden', hidden, { hidden: true }), dataOnly('lane')])

        controller.setRate(2)
        expect([a.rate, hidden.rate]).toEqual([2, 2])
        controller.play()
        time.seconds(1)
        expect(controller.getState().t).toBeCloseTo(2, 1)
        expect(a.position).toBeCloseTo(controller.getState().t, 6)

        controller.setRate(8)
        expect(controller.getState().rate).toBe(2)
        controller.setRate(0.1)
        expect(controller.getState().rate).toBe(0.25)
        expect([a.rate, hidden.rate]).toEqual([0.25, 0.25])

        const added = time.media()
        controller.setRuns([video('a', a), video('hidden', hidden, { hidden: true }), video('added', added)])
        expect(added.rate).toBe(0.25)
    })
})

describe('clock groups', () => {
    const cueAhead = (seconds: number) => ({
        runTime: (t: number) => t + seconds,
        masterTime: (runTime: number) => runTime - seconds,
    })

    it('moves every member of a group as one on its group target, each with its own offset', () => {
        const { time, controller } = setup()
        const solo = time.media()
        const first = time.media()
        const second = time.media()
        controller.setRuns([
            video('solo', solo),
            video('first', first, { group: 'team' }),
            video('second', second, { group: 'team', offset: 0.25 }),
        ])

        controller.setGroupTarget('team', cueAhead(2))

        expect(solo.seeks()).toEqual([])
        expect(first.seeks()).toEqual([2])
        expect(second.seeks()).toEqual([0.25, 2.25])
        controller.play()
        time.seconds(1)
        const { t, runTimes } = controller.getState()
        expect(runTimes.first).toBeCloseTo(t + 2, 9)
        expect(runTimes.second).toBe(runTimes.first)
        expect(first.position).toBeCloseTo(t + 2, 6)
        expect(second.position).toBeCloseTo(t + 2.25, 6)
        expect(solo.position).toBeCloseTo(t, 6)
    })

    it('holds the whole page when one member of a group stalls', () => {
        const { time, controller } = setup()
        const solo = time.media()
        const first = time.media()
        const second = time.media()
        controller.setRuns([video('solo', solo), video('first', first, { group: 'team' }), video('second', second, { group: 'team' })])
        controller.play()
        time.seconds(1)

        second.stall()

        expect([solo.playing, first.playing, second.playing]).toEqual([false, false, false])
        second.recover()
        expect([solo.playing, first.playing, second.playing]).toEqual([true, true, true])
    })

    it('goes back to Race for every group on reset', () => {
        const { time, controller } = setup()
        const member = time.media()
        controller.setRuns([video('member', member, { group: 'team' })])
        controller.seek(5)
        controller.setGroupTarget('team', cueAhead(3))
        expect(controller.getState().runTimes.member).toBe(8)

        controller.resetTargets()

        expect(controller.getState().runTimes.member).toBe(5)
        expect(member.seeks()).toEqual([5, 8, 5])
    })

    it('extends the timeline when a group target reaches a cap after the slowest cap', () => {
        const { controller } = setup()
        controller.setRuns([dataOnly('ref', { cap: 10 }), dataOnly('behind', { cap: 9, group: 'late' })])
        expect(controller.getState().end).toBe(10)

        controller.setGroupTarget('late', cueAhead(-2.5))

        expect(controller.getState().end).toBe(11.5)
    })
})

describe('visibility', () => {
    it('never waits for a hidden video and sends it nothing', () => {
        const { time, controller } = setup()
        const shown = time.media()
        const hidden = time.media({ ready: false })
        controller.setRuns([video('shown', shown), video('hidden', hidden, { hidden: true })])

        controller.play()
        time.seconds(1)

        expect(shown.playing).toBe(true)
        expect(controller.getState().stalled).toEqual([])
        expect(hidden.commands).toEqual([{ type: 'rate', rate: 1 }])
        expect(controller.getState().runTimes.hidden).toBeCloseTo(controller.getState().t, 9)
    })

    it('seeks a video to its target when it is revealed, then plays everyone together', () => {
        const { time, controller } = setup()
        const shown = time.media()
        const other = time.media()
        controller.setRuns([video('shown', shown), video('other', other, { hidden: true })])
        controller.play()
        time.seconds(2)

        controller.setRuns([video('shown', shown, { hidden: true }), video('other', other)])

        expect(shown.playing).toBe(false)
        expect(other.seeks()).toHaveLength(1)
        expect(other.seeks()[0]).toBeCloseTo(controller.getState().t, 6)
        expect(other.playing).toBe(false)
        time.frames(3)
        expect(other.playing).toBe(true)
        time.seconds(1)
        expect(other.position).toBeCloseTo(controller.getState().t, 6)
    })
})

describe('video errors', () => {
    it('reports the run and keeps the others playing', () => {
        const { time, controller } = setup()
        const a = time.media()
        const broken = time.media()
        controller.setRuns([video('a', a), video('broken', broken)])
        controller.play()
        time.seconds(1)
        broken.clearCommands()

        expect(() => broken.fail()).not.toThrow()
        time.seconds(1)

        expect(controller.getState()).toMatchObject({ playing: true, errored: ['broken'], stalled: [] })
        expect(a.playing).toBe(true)
        expect(broken.commands).toEqual([])
        expect(controller.getState().runTimes.broken).toBeCloseTo(controller.getState().t, 9)
    })

    it('releases the hold when the stalled video errors', () => {
        const { time, controller } = setup()
        const a = time.media()
        const broken = time.media({ ready: false })
        controller.setRuns([video('a', a), video('broken', broken)])
        controller.play()
        time.frames(5)
        expect(a.playing).toBe(false)

        broken.fail()

        expect(a.playing).toBe(true)
        expect(controller.getState().stalled).toEqual([])
    })

    it('keeps the error reported once the run is dropped to data-only, until it gets a new video', () => {
        const { time, controller } = setup()
        const broken = time.media()
        controller.setRuns([video('broken', broken)])
        broken.fail()

        controller.setRuns([dataOnly('broken')])
        expect(controller.getState().errored).toEqual(['broken'])

        controller.setRuns([video('broken', time.media())])
        expect(controller.getState().errored).toEqual([])
    })
})

describe('changing the set', () => {
    it('pauses and lets go of a video whose run leaves the set, and plays on with the rest', () => {
        const { time, controller } = setup()
        const kept = time.media()
        const removed = time.media()
        controller.setRuns([video('kept', kept), video('removed', removed)])
        controller.play()
        time.seconds(1)

        controller.setRuns([video('kept', kept)])
        removed.stall()
        time.seconds(1)

        expect(removed.playing).toBe(false)
        expect(kept.playing).toBe(true)
        expect(controller.getState().stalled).toEqual([])
    })

    it('seeks a run added during playback to its target and starts everyone together', () => {
        const { time, controller } = setup()
        const first = time.media()
        controller.setRuns([video('first', first)])
        controller.play()
        time.seconds(1)

        const added = time.media()
        controller.setRuns([video('first', first), video('added', added)])
        time.seconds(1)

        expect(added.seeks()).toHaveLength(1)
        expect([first.playing, added.playing]).toEqual([true, true])
        expect(added.position).toBeCloseTo(controller.getState().t, 6)
        expect(first.position).toBeCloseTo(controller.getState().t, 6)
    })

    it('pauses every video and stops listening when disposed', () => {
        const { time, controller } = setup()
        const a = time.media()
        controller.setRuns([video('a', a)])
        controller.play()
        time.seconds(1)
        const heard: number[] = []
        controller.subscribe(() => heard.push(controller.getState().t))

        controller.dispose()
        a.stall()
        time.seconds(1)

        expect(a.playing).toBe(false)
        expect(heard).toEqual([])
    })
})

describe('media that report their events at once', () => {
    it('hold, re-seek and resume the same way', () => {
        const { time, controller } = setup()
        const a = time.media({ syncEvents: true, seekFrames: Number.POSITIVE_INFINITY })
        const b = time.media({ syncEvents: true })
        controller.setRuns([video('a', a), video('b', b)])
        controller.play()
        time.seconds(1)

        a.drift(0.05)
        time.frames(1)
        expect(a.seeks()).toHaveLength(1)
        expect([a.playing, b.playing]).toEqual([false, false])

        a.finishSeek()
        expect([a.playing, b.playing]).toEqual([true, true])
        time.seconds(1)
        expect(a.position).toBeCloseTo(controller.getState().t, 6)
        expect(b.position).toBeCloseTo(controller.getState().t, 6)
    })
})
