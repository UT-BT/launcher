import { useEffect, useState, type CSSProperties } from 'react'
import { Button } from '@/app/components/ui/button'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { getDeviceEnvironment, subscribeDeviceEnvironment } from '../useDeviceEnvironment'
import { diagnosticRows, formatDiagnosticReport, type DiagnosticSample, type Insets } from './mobileDiagnostics'

const SAMPLE_INTERVAL_MS = 250

type Measurement = Omit<DiagnosticSample, 'activeView' | 'activeParams'>
type CopyStatus = 'idle' | 'copied' | 'failed'

const PANEL: CSSProperties = {
    zIndex: 1000,
    right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
    width: '20rem',
    maxWidth: 'calc(100vw - 1rem)',
    maxHeight: '70dvh',
}
const PANEL_AT_TOP: CSSProperties = { ...PANEL, top: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }
const PANEL_AT_BOTTOM: CSSProperties = { ...PANEL, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }

function createSafeAreaProbe(): HTMLElement {
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 0',
        'height: 0',
        'visibility: hidden',
        'pointer-events: none',
        'padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
    ].join(';')
    document.body.appendChild(probe)
    return probe
}

function readSafeArea(probe: HTMLElement | null): Insets {
    if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 }
    const style = window.getComputedStyle(probe)
    return {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0,
    }
}

function countOpenModals(): number {
    const backdrops = document.querySelectorAll('[data-modal-backdrop]').length
    const otherDialogs = Array.from(document.querySelectorAll('[aria-modal="true"]'))
        .filter(dialog => !dialog.closest('[data-modal-backdrop]'))
        .length
    return backdrops + otherDialogs
}

function readShellScroll(): Measurement['shellScroll'] {
    const shell = document.querySelector('main')
    if (!shell) return null
    return { top: shell.scrollTop, max: Math.max(0, shell.scrollHeight - shell.clientHeight) }
}

function measure(probe: HTMLElement | null): Measurement {
    return {
        environment: getDeviceEnvironment(),
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        windowScroll: { x: window.scrollX, y: window.scrollY },
        shellScroll: readShellScroll(),
        safeArea: readSafeArea(probe),
        openModals: countOpenModals(),
        scrollLocks: null,
        path: window.location.pathname + window.location.search,
    }
}

function useMeasurement(): Measurement {
    const [measurement, setMeasurement] = useState(() => measure(null))

    useEffect(() => {
        const probe = createSafeAreaProbe()
        let frame: number | null = null
        const sample = () => setMeasurement(measure(probe))
        const sampleNextFrame = () => {
            if (frame !== null) return
            frame = window.requestAnimationFrame(() => {
                frame = null
                sample()
            })
        }

        sample()
        const interval = window.setInterval(sample, SAMPLE_INTERVAL_MS)
        const unsubscribe = subscribeDeviceEnvironment(sampleNextFrame)
        document.addEventListener('scroll', sampleNextFrame, true)
        return () => {
            window.clearInterval(interval)
            if (frame !== null) window.cancelAnimationFrame(frame)
            unsubscribe()
            document.removeEventListener('scroll', sampleNextFrame, true)
            probe.remove()
        }
    }, [])

    return measurement
}

interface DiagnosticOverlayProps {
    onClose: () => void
}

export function DiagnosticOverlay({ onClose }: DiagnosticOverlayProps) {
    const { entry } = useNavigation()
    const measurement = useMeasurement()
    const [atBottom, setAtBottom] = useState(false)
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
    const [report, setReport] = useState('')
    const sample: DiagnosticSample = { ...measurement, activeView: entry.view, activeParams: entry.params }
    const rows = diagnosticRows(sample)

    useEffect(() => {
        if (copyStatus !== 'copied') return
        const timer = window.setTimeout(() => setCopyStatus('idle'), 1500)
        return () => window.clearTimeout(timer)
    }, [copyStatus])

    const copyReport = async () => {
        const text = formatDiagnosticReport(sample, { capturedAt: new Date().toISOString(), userAgent: navigator.userAgent })
        setReport(text)
        try {
            await navigator.clipboard.writeText(text)
            setCopyStatus('copied')
        } catch {
            setCopyStatus('failed')
        }
    }

    return (
        <section
            aria-label="Mobile diagnostics"
            style={atBottom ? PANEL_AT_BOTTOM : PANEL_AT_TOP}
            className="fixed overflow-y-auto rounded-lg border border-hairline/20 bg-background text-foreground shadow-2xl p-3 font-mono text-xs"
        >
            <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile diagnostics</h2>
            <dl className="grid gap-y-0.5">
                {rows.map(row => (
                    <div key={row.label} className="flex gap-2">
                        <dt className="w-36 shrink-0 text-muted-foreground">{row.label}</dt>
                        <dd className="min-w-0 break-words">{row.value}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 font-sans">
                <Button size="sm" className="h-11" onClick={() => void copyReport()}>
                    {copyStatus === 'copied' ? 'Copied' : 'Copy report'}
                </Button>
                <Button size="sm" variant="secondary" className="h-11" onClick={() => setAtBottom(current => !current)}>
                    {atBottom ? 'Move up' : 'Move down'}
                </Button>
                <Button size="sm" variant="ghost" className="h-11" onClick={onClose}>
                    Close
                </Button>
            </div>
            <p role="status" className="mt-2 font-sans text-xs text-muted-foreground">
                {copyStatus === 'copied' && 'Report copied to the clipboard.'}
                {copyStatus === 'failed' && 'Copy failed. Select the text below and copy it.'}
            </p>
            {copyStatus === 'failed' && (
                <textarea
                    readOnly
                    aria-label="Diagnostic report"
                    value={report}
                    onFocus={event => event.currentTarget.select()}
                    className="mt-2 h-40 w-full rounded border border-hairline/20 bg-background p-2 font-mono text-base text-foreground"
                />
            )}
        </section>
    )
}
