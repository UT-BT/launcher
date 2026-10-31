import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { MOVE_AIR } from '@/app/utils/api'
import { buildRunDeltaCard, type ReplayCard } from './runDeltaCard'
import { MIN_ZOOM_MS, rangeZoom, sectorZoom, windowTimeAxis, zoomPair, zoomedSpeed } from './speedZoom'
import { spacedMarkers } from './SpeedPlot'

const PAIR = zoomPair('runner', 'reference')

function separatedCard(): ReplayCard {
    const card = buildRunDeltaCard({
        comparison: runCompareFixture('separated'),
        capHasReplay: true,
        reference: { alias: 'Nettlez', hasReplay: true },
    })
    if (card.kind !== 'replay') throw new Error('expected a replay card')
    return card
}

describe('zoom windows', () => {
    it('zooms to a sector exactly', () => {
        const card = separatedCard()

        expect(sectorZoom(PAIR, card.chart.sectors, 4)).toEqual({ pair: PAIR, startMs: 30231, endMs: 40308, sector: 4 })
        expect(sectorZoom(PAIR, card.chart.sectors, 11)).toBeNull()
    })

    it('orders a dragged range and keeps it inside the run', () => {
        expect(rangeZoom(PAIR, 9000, 4000, 20000)).toEqual({ pair: PAIR, startMs: 4000, endMs: 9000, sector: null })
        expect(rangeZoom(PAIR, -500, 3000, 20000)).toMatchObject({ startMs: 0 })
        expect(rangeZoom(PAIR, 19000, 21000, 20000)).toMatchObject({ endMs: 20000 })
    })

    it(`never zooms closer than ${MIN_ZOOM_MS} ms`, () => {
        const zoom = rangeZoom(PAIR, 5000, 5100, 20000)

        expect(zoom.endMs - zoom.startMs).toBe(MIN_ZOOM_MS)
        expect((zoom.startMs + zoom.endMs) / 2).toBe(5050)
    })
})

describe('the zoomed time axis', () => {
    it.each([
        [41000, 50000, 82421, 2000, ['0:42', '0:44', '0:46', '0:48', '0:50']],
        [41000, 43000, 82421, 500, ['0:41.0', '0:41.5', '0:42.0', '0:42.5', '0:43.0']],
        [3000, 4000, 11830, 200, ['3.0s', '3.2s', '3.4s', '3.6s', '3.8s', '4.0s']],
        [0, 82421, 82421, 15000, ['0:00', '0:15', '0:30', '0:45', '1:00', '1:15']],
    ])('ticks %d–%d ms of a %d ms run every %d ms', (start, end, duration, step, labels) => {
        const axis = windowTimeAxis(start, end, duration)

        expect(axis.stepMs).toBe(step)
        expect(axis.domainMs).toEqual([start, end])
        expect(axis.ticks.map(t => t.label)).toEqual(labels)
        expect(axis.ticks.length).toBeLessThanOrEqual(7)
    })
})

describe('the zoomed speed', () => {
    it('draws every sample of both runs inside the window, plus the one just outside each edge', () => {
        const card = separatedCard()
        const motion = runCompareFixture('motion')
        const zoom = sectorZoom(PAIR, card.chart.sectors, 4)!

        const zoomed = zoomedSpeed(card.speed.chart, motion, zoom, card.chart.x.domainMs[1])
        const inside = motion.reference.segments[0].filter(([t]) => t >= zoom.startMs && t <= zoom.endMs)

        expect(zoomed.detailed).toBe(true)
        expect(zoomed.reference).toHaveLength(1)
        expect(zoomed.reference[0].length).toBe(inside.length + 2)
        expect(zoomed.reference[0][0][0]).toBeLessThan(zoom.startMs)
        expect(zoomed.reference[0].at(-1)![0]).toBeGreaterThan(zoom.endMs)
        expect(zoomed.x.domainMs).toEqual([zoom.startMs, zoom.endMs])
    })

    it('keeps only the dodges, jumps and kicks inside the window', () => {
        const card = separatedCard()
        const motion = runCompareFixture('motion')
        const zoom = sectorZoom(PAIR, card.chart.sectors, 4)!

        const zoomed = zoomedSpeed(card.speed.chart, motion, zoom, card.chart.x.domainMs[1])

        expect(zoomed.referenceEvents).toEqual(motion.reference.events.filter(e => e.t_ms >= zoom.startMs && e.t_ms <= zoom.endMs))
        expect(zoomed.referenceEvents.length).toBeGreaterThan(0)
        expect(zoomed.runnerEvents.every(e => e.t_ms >= zoom.startMs && e.t_ms <= zoom.endMs)).toBe(true)
    })

    it('marks the time in the air as non-overlapping spans inside the window', () => {
        const card = separatedCard()
        const motion = runCompareFixture('motion')
        const zoom = sectorZoom(PAIR, card.chart.sectors, 4)!

        const { referenceAir } = zoomedSpeed(card.speed.chart, motion, zoom, card.chart.x.domainMs[1])
        const airborne = motion.reference.segments[0].filter(([t, , state]) => state === MOVE_AIR && t >= zoom.startMs && t < zoom.endMs)

        expect(referenceAir.length).toBeGreaterThan(0)
        referenceAir.forEach(([from, to], i) => {
            expect(from).toBeGreaterThanOrEqual(zoom.startMs)
            expect(to).toBeLessThanOrEqual(zoom.endMs)
            expect(to).toBeGreaterThanOrEqual(from)
            if (i > 0) expect(from).toBeGreaterThan(referenceAir[i - 1][1])
        })
        for (const [t] of airborne) expect(referenceAir.some(([from, to]) => t >= from && t <= to)).toBe(true)
    })

    it('rescales the speed axis to the fastest sample in the window', () => {
        const card = separatedCard()
        const motion = runCompareFixture('motion')
        const zoom = sectorZoom(PAIR, card.chart.sectors, 4)!

        const zoomed = zoomedSpeed(card.speed.chart, motion, zoom, card.chart.x.domainMs[1])
        const fastest = Math.max(...[...zoomed.runner, ...zoomed.reference].flat().map(([, speed]) => speed))

        expect(zoomed.y.domain[1]).toBeGreaterThan(fastest)
        expect(zoomed.y.domain[1]).toBeLessThanOrEqual(fastest * 1.05 + zoomed.y.step)
    })

    it('falls back to the smoothed speed with no markers while the samples are missing', () => {
        const card = separatedCard()
        const zoom = sectorZoom(PAIR, card.chart.sectors, 4)!

        const zoomed = zoomedSpeed(card.speed.chart, null, zoom, card.chart.x.domainMs[1])

        expect(zoomed.detailed).toBe(false)
        expect([zoomed.runnerEvents, zoomed.referenceEvents, zoomed.runnerAir, zoomed.referenceAir]).toEqual([[], [], [], []])
        expect(zoomed.reference[0].every(([t], i, all) => i === 0 || i === all.length - 1 || (t >= zoom.startMs && t <= zoom.endMs))).toBe(true)
    })

    it('keeps the different-line bands that reach into the window', () => {
        const card = separatedCard()
        const zoom = sectorZoom(PAIR, card.chart.sectors, 4)!

        const zoomed = zoomedSpeed(card.speed.chart, null, zoom, card.chart.x.domainMs[1])

        expect(zoomed.bands).toEqual(card.speed.chart.bands.filter(b => b.endMs >= zoom.startMs && b.startMs <= zoom.endMs))
        expect(zoomed.bands.length).toBeGreaterThan(0)
    })
})

describe('the movement markers', () => {
    it('leave out a marker that would overlap the one before it in the same row', () => {
        const events = [0, 5, 20, 22, 40].map(t => ({ t_ms: t, kind: 'dodge' as const, direction: 'L' as const }))

        expect(spacedMarkers(events, ms => ms).map(e => e.t_ms)).toEqual([0, 20, 40])
        expect(spacedMarkers(events, ms => ms * 10).map(e => e.t_ms)).toEqual([0, 5, 20, 22, 40])
    })
})
