import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { displayMapName } from '@/app/utils/format'
import { nextScreenshotStage, screenshotUrlFor, type ScreenshotStage } from '@/app/utils/mapScreenshots'
import { UNZOOMED, panZoom, pinchZoom, toggleZoom, type Zoom, type ZoomFrame, type ZoomPoint } from './screenshotZoom'

const TAP_MOVE_PX = 10
const TAP_MS = 300
const DOUBLE_TAP_PX = 30

interface MapScreenshotViewerProps {
    isOpen: boolean
    onClose: () => void
    mapName: string
    version?: string | null
}

interface Gesture {
    start: Zoom
    from: ZoomPoint[]
}

interface Tap {
    time: number
    point: ZoomPoint
}

function blockBrowserZoom(event: Event) {
    event.preventDefault()
}

export function MapScreenshotViewer({ isOpen, onClose, mapName, version }: MapScreenshotViewerProps) {
    const frameRef = useRef<HTMLDivElement>(null)
    const [zoom, setZoom] = useState<Zoom>(UNZOOMED)
    const zoomRef = useRef<Zoom>(UNZOOMED)
    const pointers = useRef(new Map<number, ZoomPoint>())
    const gesture = useRef<Gesture>({ start: UNZOOMED, from: [] })
    const press = useRef<Tap | null>(null)
    const lastTap = useRef<Tap | null>(null)
    const imageKey = `${mapName}|${version ?? ''}`
    const [fallback, setFallback] = useState<{ key: string; stage: ScreenshotStage }>({ key: imageKey, stage: 'derived' })
    const stage = fallback.key === imageKey ? fallback.stage : 'derived'

    useEffect(() => {
        const frame = frameRef.current
        if (!isOpen || !frame) return
        const options = { passive: false }
        frame.addEventListener('touchmove', blockBrowserZoom, options)
        frame.addEventListener('gesturestart', blockBrowserZoom, options)
        frame.addEventListener('gesturechange', blockBrowserZoom, options)
        let width = frame.getBoundingClientRect().width
        const resized = new ResizeObserver(() => {
            const next = frame.getBoundingClientRect().width
            if (next === width) return
            width = next
            if (zoomRef.current === UNZOOMED) return
            zoomRef.current = UNZOOMED
            setZoom(UNZOOMED)
        })
        resized.observe(frame)
        return () => {
            resized.disconnect()
            frame.removeEventListener('touchmove', blockBrowserZoom)
            frame.removeEventListener('gesturestart', blockBrowserZoom)
            frame.removeEventListener('gesturechange', blockBrowserZoom)
        }
    }, [isOpen])

    const apply = (next: Zoom) => {
        zoomRef.current = next
        setZoom(next)
    }

    const frameSize = (): ZoomFrame => {
        const rect = frameRef.current?.getBoundingClientRect()
        return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
    }

    const pointOf = (event: PointerEvent<HTMLDivElement>): ZoomPoint => {
        const rect = event.currentTarget.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const restartGesture = () => {
        gesture.current = { start: zoomRef.current, from: [...pointers.current.values()] }
    }

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const point = pointOf(event)
        pointers.current.set(event.pointerId, point)
        press.current = pointers.current.size === 1 ? { time: event.timeStamp, point } : null
        restartGesture()
    }

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId)) return
        pointers.current.set(event.pointerId, pointOf(event))
        const current = [...pointers.current.values()]
        const { start, from } = gesture.current
        if (current.length >= 2 && from.length >= 2) {
            apply(pinchZoom(start, [from[0], from[1]], [current[0], current[1]], frameSize()))
        } else if (current.length === 1 && from.length === 1) {
            apply(panZoom(start, from[0], current[0], frameSize()))
        }
    }

    const handleTap = (point: ZoomPoint, time: number) => {
        const previous = lastTap.current
        if (previous && time - previous.time < TAP_MS && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < DOUBLE_TAP_PX) {
            lastTap.current = null
            apply(toggleZoom(zoomRef.current, point, frameSize()))
            return
        }
        lastTap.current = { time, point }
    }

    const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.delete(event.pointerId)) return
        const pressed = press.current
        const point = pointOf(event)
        if (event.type === 'pointerup' && pressed && pointers.current.size === 0
            && event.timeStamp - pressed.time < TAP_MS
            && Math.hypot(point.x - pressed.point.x, point.y - pressed.point.y) < TAP_MOVE_PX) {
            handleTap(point, event.timeStamp)
        }
        press.current = null
        restartGesture()
    }

    const close = () => {
        pointers.current.clear()
        lastTap.current = null
        apply(UNZOOMED)
        onClose()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={close}
            title={displayMapName(mapName)}
            footer={null}
            maxWidth="1280px"
            className="h-[90dvh]"
        >
            <div
                ref={frameRef}
                role="img"
                aria-label={`${displayMapName(mapName)} screenshot. Pinch or double-tap to zoom.`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                className="relative w-full h-full overflow-hidden touch-none select-none rounded-lg bg-muted/20"
            >
                <img
                    src={screenshotUrlFor(stage, mapName, 'hero', version)}
                    alt=""
                    draggable={false}
                    decoding="async"
                    style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`, transformOrigin: '0 0' }}
                    className="w-full h-full object-contain pointer-events-none will-change-transform"
                    onError={() => setFallback({ key: imageKey, stage: nextScreenshotStage(stage) })}
                />
            </div>
        </Modal>
    )
}
