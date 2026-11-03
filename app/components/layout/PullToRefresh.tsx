import { useEffect, useRef, useState, type RefObject } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import { scrollLockCount } from '@/app/components/ui/scrollLock'
import {
    IDLE_PULL,
    PULL_TRIGGER_PX,
    pullArmed,
    pullBlocker,
    pullMoved,
    pullOffset,
    pullTriggers,
    type PullGesture,
    type PullPathStep,
} from '@/app/components/layout/pullGesture'

const INDICATOR_PX = 40
const MIN_SPIN_MS = 600
const SETTLE_MS = 200

type Phase = 'idle' | 'pulling' | 'refreshing' | 'settling'

function pathFrom(target: EventTarget | null, scroller: HTMLElement): PullPathStep[] {
    const path: PullPathStep[] = []
    for (let node = target instanceof Element ? target : null; node && node !== scroller; node = node.parentElement) {
        path.push({ box: node, style: getComputedStyle(node), rangeInput: node instanceof HTMLInputElement && node.type === 'range' })
    }
    return path
}

function TouchPullToRefresh({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
    const refresh = usePageRefresh()
    const refreshRef = useRef(refresh)
    refreshRef.current = refresh
    const [phase, setPhase] = useState<Phase>('idle')
    const phaseRef = useRef(phase)
    phaseRef.current = phase
    const [distance, setDistance] = useState(0)
    const [spun, setSpun] = useState(false)
    const pageRefreshing = refresh?.display.refreshing ?? false

    useEffect(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        let gesture: PullGesture = IDLE_PULL

        const refreshPage = () => {
            const current = refreshRef.current
            if (!current || current.display.refreshing || current.display.disabled) return
            current.trigger()
        }

        const end = (refreshes: boolean) => {
            const pulled = gesture.phase === 'pulling'
            gesture = IDLE_PULL
            if (refreshes) {
                setSpun(false)
                setPhase('refreshing')
                refreshPage()
            } else if (pulled) {
                setPhase('settling')
            }
        }

        const onPointerDown = (event: PointerEvent) => {
            if (!event.isPrimary) {
                end(false)
                return
            }
            if (phaseRef.current === 'refreshing') return
            const blocker = pullBlocker(
                { pointerType: event.pointerType, primary: event.isPrimary, scrollTop: scroller.scrollTop, scrollLocks: scrollLockCount() },
                pathFrom(event.target, scroller),
            )
            gesture = blocker ? IDLE_PULL : pullArmed(event.pointerId, { x: event.clientX, y: event.clientY })
        }

        const onPointerMove = (event: PointerEvent) => {
            const next = pullMoved(gesture, event.pointerId, { x: event.clientX, y: event.clientY })
            if (next === gesture) return
            gesture = next
            if (next.phase !== 'pulling') return
            setPhase('pulling')
            setDistance(next.distance)
        }

        const onPointerUp = (event: PointerEvent) => {
            if (gesture.phase !== 'idle' && gesture.pointerId === event.pointerId) end(pullTriggers(gesture))
        }

        const onPointerCancel = (event: PointerEvent) => {
            if (gesture.phase !== 'idle' && gesture.pointerId === event.pointerId) end(false)
        }

        const onTouchMove = (event: TouchEvent) => {
            if (gesture.phase === 'pulling' && event.cancelable) event.preventDefault()
        }

        scroller.addEventListener('pointerdown', onPointerDown, { passive: true })
        scroller.addEventListener('pointermove', onPointerMove, { passive: true })
        scroller.addEventListener('pointerup', onPointerUp, { passive: true })
        scroller.addEventListener('pointercancel', onPointerCancel, { passive: true })
        scroller.addEventListener('touchmove', onTouchMove, { passive: false })
        return () => {
            scroller.removeEventListener('pointerdown', onPointerDown)
            scroller.removeEventListener('pointermove', onPointerMove)
            scroller.removeEventListener('pointerup', onPointerUp)
            scroller.removeEventListener('pointercancel', onPointerCancel)
            scroller.removeEventListener('touchmove', onTouchMove)
        }
    }, [scrollerRef])

    useEffect(() => {
        if (phase !== 'refreshing') return
        const timer = setTimeout(() => setSpun(true), MIN_SPIN_MS)
        return () => clearTimeout(timer)
    }, [phase])

    useEffect(() => {
        if (phase === 'refreshing' && spun && !pageRefreshing) setPhase('settling')
    }, [phase, spun, pageRefreshing])

    useEffect(() => {
        if (phase !== 'settling') return
        const timer = setTimeout(() => setPhase('idle'), SETTLE_MS)
        return () => clearTimeout(timer)
    }, [phase])

    if (phase === 'idle') return null

    const refreshing = phase === 'refreshing'
    const offset = phase === 'pulling' ? pullOffset(distance) : refreshing ? pullOffset(PULL_TRIGGER_PX) : 0
    const ready = refreshing || (phase === 'pulling' && distance >= PULL_TRIGGER_PX)
    const semantics = phase === 'pulling'
        ? {
            role: 'progressbar',
            'aria-label': 'Pull to refresh',
            'aria-valuenow': Math.min(100, Math.round(distance / PULL_TRIGGER_PX * 100)),
        }
        : refreshing ? { role: 'status', 'aria-label': 'Refreshing' } : { 'aria-hidden': true }

    return (
        <div className="relative z-20 h-0 pointer-events-none">
            <div
                {...semantics}
                className={cn(
                    'absolute left-1/2 top-0 grid size-10 place-items-center rounded-full border border-hairline/10 bg-card shadow-lg',
                    phase !== 'pulling' && 'transition-transform duration-200',
                )}
                style={{ transform: `translate(-50%, ${offset - INDICATOR_PX}px)` }}
            >
                <RefreshCw
                    aria-hidden
                    className={cn('size-5', ready ? 'text-accent-400' : 'text-muted-foreground', refreshing && 'motion-safe:animate-spin')}
                />
            </div>
        </div>
    )
}

export function PullToRefresh({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
    const touch = useDeviceEnvironment(environment => environment.touch)
    return touch ? <TouchPullToRefresh scrollerRef={scrollerRef} /> : null
}
