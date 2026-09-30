import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { PickBanCountdown } from '../pickBanView'
import { introCountdownWords } from '../pickBanCopy'
import { PICK_BAN_TONES, type PickBanTone } from './pickBanTone'
import { usePickBanAnimate } from './PickBanMotion'

type CountdownPainter = (element: HTMLElement, remainingMs: number, fraction: number) => void

const REDUCED_MOTION_STEP_MS = 1_000

function formatRemaining(remainingMs: number): string {
    const seconds = Math.ceil(remainingMs / 1000)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const paintText: CountdownPainter = (element, remainingMs) => {
    element.textContent = formatRemaining(remainingMs)
}

const paintIntroWords: CountdownPainter = (element, remainingMs) => {
    const words = introCountdownWords(remainingMs)
    if (element.textContent !== words) element.textContent = words
}

const paintBar: CountdownPainter = (element, _remainingMs, fraction) => {
    element.style.transform = `scaleX(${fraction})`
}

function useCountdownFrame<E extends HTMLElement>(countdown: PickBanCountdown | null, paint: CountdownPainter, stepMs = 0) {
    const ref = useRef<E>(null)
    const endsAt = countdown?.endsAt ?? null
    const frozenMs = countdown && countdown.endsAt === null ? countdown.remainingMs : null
    const totalMs = countdown?.totalMs ?? 0

    useLayoutEffect(() => {
        const element = ref.current
        if (!element) return
        const draw = (remainingMs: number) => {
            const shownMs = stepMs > 0 ? Math.ceil(remainingMs / stepMs) * stepMs : remainingMs
            paint(element, shownMs, totalMs > 0 ? Math.min(1, shownMs / totalMs) : 0)
        }
        if (endsAt === null) {
            draw(frozenMs ?? 0)
            return
        }
        let frame = 0
        const tick = () => {
            const remainingMs = Math.max(0, endsAt - Date.now())
            draw(remainingMs)
            if (remainingMs > 0) frame = requestAnimationFrame(tick)
        }
        tick()
        return () => cancelAnimationFrame(frame)
    }, [endsAt, frozenMs, totalMs, paint, stepMs])

    return ref
}

export function CountdownText({ countdown, className }: { countdown: PickBanCountdown | null; className?: string }) {
    const ref = useCountdownFrame<HTMLSpanElement>(countdown, paintText)
    return <span ref={ref} role="timer" className={cn('font-mono tabular-nums', className)} />
}

export function IntroCountdownWords({ countdown, className }: { countdown: PickBanCountdown | null; className?: string }) {
    const ref = useCountdownFrame<HTMLParagraphElement>(countdown, paintIntroWords)
    return <p ref={ref} role="timer" className={className} />
}

export function CountdownBar({ countdown, tone, className }: {
    countdown: PickBanCountdown | null
    tone: PickBanTone
    className?: string
}) {
    const animate = usePickBanAnimate()
    const ref = useCountdownFrame<HTMLDivElement>(countdown, paintBar, animate ? 0 : REDUCED_MOTION_STEP_MS)
    return (
        <div aria-hidden className={cn('h-1 w-full overflow-hidden rounded-full bg-hairline/10', className)}>
            <div ref={ref} className={cn('h-full w-full origin-left will-change-transform', PICK_BAN_TONES[tone].solid)} />
        </div>
    )
}
