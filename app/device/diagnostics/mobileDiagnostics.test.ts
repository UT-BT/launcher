import { describe, expect, it } from 'vitest'
import { deviceEnvironmentFrom } from '../deviceEnvironment'
import { isMobileDebugRequested, movedBeyondLongPressTolerance } from './diagnosticTrigger'
import { diagnosticRows, formatDiagnosticReport, type DiagnosticSample } from './mobileDiagnostics'

const SAMPLE: DiagnosticSample = {
    environment: deviceEnvironmentFrom({
        touch: true,
        belowLg: true,
        portrait: false,
        standaloneDisplayMode: true,
        navigatorStandalone: false,
        visualViewport: { scale: 1.5, offsetLeft: 12.345, offsetTop: 40, pageLeft: 12.345, pageTop: 340, width: 562.6667, height: 260 },
        innerWidth: 844,
        innerHeight: 390,
    }),
    innerWidth: 844,
    innerHeight: 390,
    windowScroll: { x: 0, y: 300 },
    shellScroll: { top: 1200, max: 4800 },
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 },
    openModals: 1,
    scrollLocks: 1,
    activeView: 'map-detail',
    activeParams: { mapName: 'BT-Example' },
    path: '/maps/BT-Example',
}

describe('isMobileDebugRequested', () => {
    it('turns on for debug=mobile', () => {
        expect(isMobileDebugRequested('?debug=mobile')).toBe(true)
        expect(isMobileDebugRequested('?tab=wrs&debug=mobile')).toBe(true)
    })

    it('stays off for anything else', () => {
        expect(isMobileDebugRequested('')).toBe(false)
        expect(isMobileDebugRequested('?debug=1')).toBe(false)
        expect(isMobileDebugRequested('?debug=mobile2')).toBe(false)
    })
})

describe('movedBeyondLongPressTolerance', () => {
    it('keeps a press that wobbles a few pixels', () => {
        expect(movedBeyondLongPressTolerance({ x: 100, y: 100 }, { x: 106, y: 104 })).toBe(false)
    })

    it('cancels a press that turns into a drag', () => {
        expect(movedBeyondLongPressTolerance({ x: 100, y: 100 }, { x: 100, y: 125 })).toBe(true)
    })
})

describe('diagnosticRows', () => {
    it('lists every field the overlay shows, in order', () => {
        expect(diagnosticRows(SAMPLE)).toEqual([
            { label: 'Viewport scale', value: '1.5' },
            { label: 'Viewport offset', value: '12.35, 40' },
            { label: 'Viewport size', value: '562.67 × 260' },
            { label: 'Viewport page offset', value: '12.35, 340' },
            { label: 'innerHeight', value: '390' },
            { label: 'innerWidth', value: '844' },
            { label: 'Window scroll', value: '0, 300' },
            { label: 'Shell scroll', value: '1200 of 4800' },
            { label: 'Orientation', value: 'landscape' },
            { label: 'Standalone', value: 'yes' },
            { label: 'Touch', value: 'yes' },
            { label: 'Below lg', value: 'yes' },
            { label: 'Safe area', value: 'top 0, right 47, bottom 21, left 47' },
            { label: 'Open modals', value: '1' },
            { label: 'Scroll locks', value: '1' },
            { label: 'Active view', value: 'map-detail {"mapName":"BT-Example"}' },
            { label: 'Path', value: '/maps/BT-Example' },
        ])
    })

    it('shows stacked scroll locks and no locks, and n/a without a shell scroller', () => {
        const rows = diagnosticRows({ ...SAMPLE, scrollLocks: 2, shellScroll: null, activeParams: {} })
        expect(rows).toContainEqual({ label: 'Scroll locks', value: '2' })
        expect(diagnosticRows({ ...SAMPLE, scrollLocks: 0 })).toContainEqual({ label: 'Scroll locks', value: '0' })
        expect(rows).toContainEqual({ label: 'Shell scroll', value: 'n/a' })
        expect(rows).toContainEqual({ label: 'Active view', value: 'map-detail' })
    })
})

describe('formatDiagnosticReport', () => {
    it('is plain text with a header, the capture time, the browser and one line per row', () => {
        const report = formatDiagnosticReport(SAMPLE, { capturedAt: '2026-11-01T10:00:00.000Z', userAgent: 'TestPhone/1.0' })
        expect(report.split('\n')).toEqual([
            'UTBT mobile diagnostics',
            'Captured: 2026-11-01T10:00:00.000Z',
            'Browser: TestPhone/1.0',
            'Viewport scale: 1.5',
            'Viewport offset: 12.35, 40',
            'Viewport size: 562.67 × 260',
            'Viewport page offset: 12.35, 340',
            'innerHeight: 390',
            'innerWidth: 844',
            'Window scroll: 0, 300',
            'Shell scroll: 1200 of 4800',
            'Orientation: landscape',
            'Standalone: yes',
            'Touch: yes',
            'Below lg: yes',
            'Safe area: top 0, right 47, bottom 21, left 47',
            'Open modals: 1',
            'Scroll locks: 1',
            'Active view: map-detail {"mapName":"BT-Example"}',
            'Path: /maps/BT-Example',
        ])
    })
})
