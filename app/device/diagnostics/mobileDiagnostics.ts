import type { NavParams } from '@/app/components/navigation/NavigationContext'
import type { DeviceEnvironment } from '../deviceEnvironment'
import type { Point } from './diagnosticTrigger'

export interface Insets {
    top: number
    right: number
    bottom: number
    left: number
}

export interface DiagnosticSample {
    environment: DeviceEnvironment
    innerWidth: number
    innerHeight: number
    windowScroll: Point
    shellScroll: { top: number; max: number } | null
    safeArea: Insets
    openModals: number
    scrollLocks: number | null
    activeView: string
    activeParams: NavParams
    path: string
}

export interface DiagnosticRow {
    label: string
    value: string
}

function num(value: number): string {
    return String(Math.round(value * 100) / 100)
}

function yesNo(value: boolean): string {
    return value ? 'yes' : 'no'
}

function viewLabel(view: string, params: NavParams): string {
    return Object.keys(params).length > 0 ? `${view} ${JSON.stringify(params)}` : view
}

export function diagnosticRows(sample: DiagnosticSample): DiagnosticRow[] {
    const { environment, safeArea } = sample
    const { viewport } = environment
    return [
        { label: 'Viewport scale', value: num(viewport.scale) },
        { label: 'Viewport offset', value: `${num(viewport.offsetLeft)}, ${num(viewport.offsetTop)}` },
        { label: 'Viewport size', value: `${num(viewport.width)} × ${num(viewport.height)}` },
        { label: 'Viewport page offset', value: `${num(viewport.pageLeft)}, ${num(viewport.pageTop)}` },
        { label: 'innerHeight', value: num(sample.innerHeight) },
        { label: 'innerWidth', value: num(sample.innerWidth) },
        { label: 'Window scroll', value: `${num(sample.windowScroll.x)}, ${num(sample.windowScroll.y)}` },
        { label: 'Shell scroll', value: sample.shellScroll ? `${num(sample.shellScroll.top)} of ${num(sample.shellScroll.max)}` : 'n/a' },
        { label: 'Orientation', value: environment.orientation },
        { label: 'Standalone', value: yesNo(environment.standalone) },
        { label: 'Touch', value: yesNo(environment.touch) },
        { label: 'Below lg', value: yesNo(environment.belowLg) },
        { label: 'Safe area', value: `top ${num(safeArea.top)}, right ${num(safeArea.right)}, bottom ${num(safeArea.bottom)}, left ${num(safeArea.left)}` },
        { label: 'Open modals', value: String(sample.openModals) },
        { label: 'Scroll locks', value: sample.scrollLocks === null ? 'n/a' : String(sample.scrollLocks) },
        { label: 'Active view', value: viewLabel(sample.activeView, sample.activeParams) },
        { label: 'Path', value: sample.path },
    ]
}

export function formatDiagnosticReport(sample: DiagnosticSample, context: { capturedAt: string; userAgent: string }): string {
    return [
        'UTBT mobile diagnostics',
        `Captured: ${context.capturedAt}`,
        `Browser: ${context.userAgent}`,
        ...diagnosticRows(sample).map(row => `${row.label}: ${row.value}`),
    ].join('\n')
}
