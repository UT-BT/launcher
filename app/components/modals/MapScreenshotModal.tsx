import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, ZoomIn } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { uploadOwnMapScreenshot, type MapMetadata } from '@/app/utils/api'
import { displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'

const MAX_FRAME = 320
const OUTPUT_SIZE = 1024
const MIN_SOURCE_EDGE = 256
const MAX_ZOOM = 4
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp'

interface MapScreenshotModalProps {
    open: boolean
    onClose: () => void
    accessToken?: string
    mapName: string
    hasScreenshot: boolean
    screenshotVersion?: string | null
    onUploaded: (map: MapMetadata) => void
}

interface Loaded {
    image: HTMLImageElement
    objectUrl: string
}

export function MapScreenshotModal({
    open, onClose, accessToken, mapName, hasScreenshot, screenshotVersion, onUploaded,
}: MapScreenshotModalProps) {
    const [loaded, setLoaded] = useState<Loaded | null>(null)
    const [zoom, setZoom] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    const frameRef = useRef<HTMLDivElement>(null)
    const dragOrigin = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)
    const pickGeneration = useRef(0)

    const [frame, setFrame] = useState(MAX_FRAME)

    useLayoutEffect(() => {
        if (!open) return
        const element = frameRef.current
        if (!element) return
        const measure = () => setFrame(element.getBoundingClientRect().width || MAX_FRAME)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [open])

    const clampOffset = useCallback(
        (value: number, displayed: number) => Math.min(0, Math.max(frame - displayed, value)),
        [frame],
    )

    const reset = useCallback(() => {
        pickGeneration.current += 1
        setLoaded(null)
        setZoom(1)
        setOffset({ x: 0, y: 0 })
        setError(null)
        setSaving(false)
        setDragOver(false)
    }, [])

    useEffect(() => {
        if (!open) reset()
    }, [open, reset])

    useEffect(() => () => {
        if (loaded) URL.revokeObjectURL(loaded.objectUrl)
    }, [loaded])

    const sourceEdgePixels = loaded ? Math.min(loaded.image.naturalWidth, loaded.image.naturalHeight) : 0
    const maxZoom = loaded ? Math.max(1, Math.min(MAX_ZOOM, sourceEdgePixels / MIN_SOURCE_EDGE)) : MAX_ZOOM
    const baseScale = loaded ? frame / sourceEdgePixels : 1
    const displayedWidth = loaded ? loaded.image.naturalWidth * baseScale * zoom : frame
    const displayedHeight = loaded ? loaded.image.naturalHeight * baseScale * zoom : frame

    useEffect(() => {
        if (!loaded) return
        setOffset(prev => ({
            x: Math.min(0, Math.max(frame - displayedWidth, prev.x)),
            y: Math.min(0, Math.max(frame - displayedHeight, prev.y)),
        }))
    }, [loaded, frame, displayedWidth, displayedHeight])

    const accept = (file: File | null | undefined) => {
        if (!file) return
        pickGeneration.current += 1
        const generation = pickGeneration.current
        setError(null)

        const objectUrl = URL.createObjectURL(file)
        const image = new Image()
        const isStale = () => generation !== pickGeneration.current

        image.onload = () => {
            if (isStale()) {
                URL.revokeObjectURL(objectUrl)
                return
            }
            if (Math.min(image.naturalWidth, image.naturalHeight) < MIN_SOURCE_EDGE) {
                URL.revokeObjectURL(objectUrl)
                setLoaded(null)
                setError(`That image is only ${image.naturalWidth} × ${image.naturalHeight}. Screenshots need to be at least ${MIN_SOURCE_EDGE} × ${MIN_SOURCE_EDGE}.`)
                return
            }
            const cover = frame / Math.min(image.naturalWidth, image.naturalHeight)
            const width = image.naturalWidth * cover
            const height = image.naturalHeight * cover
            setLoaded({ image, objectUrl })
            setZoom(1)
            setOffset({ x: (frame - width) / 2, y: (frame - height) / 2 })
        }
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            if (isStale()) return
            setLoaded(null)
            setError('That file could not be read as an image. Use a PNG, JPG or WEBP.')
        }
        image.src = objectUrl
    }

    const changeZoom = (next: number) => {
        if (!loaded) return
        const clamped = Math.min(maxZoom, Math.max(1, next))
        const width = loaded.image.naturalWidth * baseScale * clamped
        const height = loaded.image.naturalHeight * baseScale * clamped
        const centreX = (frame / 2 - offset.x) / (displayedWidth || 1)
        const centreY = (frame / 2 - offset.y) / (displayedHeight || 1)
        setZoom(clamped)
        setOffset({
            x: clampOffset(frame / 2 - centreX * width, width),
            y: clampOffset(frame / 2 - centreY * height, height),
        })
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!loaded) return
        e.currentTarget.setPointerCapture(e.pointerId)
        dragOrigin.current = { pointerX: e.clientX, pointerY: e.clientY, x: offset.x, y: offset.y }
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const origin = dragOrigin.current
        if (!origin || !loaded) return
        setOffset({
            x: clampOffset(origin.x + (e.clientX - origin.pointerX), displayedWidth),
            y: clampOffset(origin.y + (e.clientY - origin.pointerY), displayedHeight),
        })
    }

    const endDrag = () => { dragOrigin.current = null }

    const save = async () => {
        if (!loaded || !accessToken) return
        setSaving(true)
        setError(null)
        try {
            const scale = baseScale * zoom
            const sourceEdge = frame / scale
            const sourceX = -offset.x / scale
            const sourceY = -offset.y / scale
            const outputEdge = Math.min(OUTPUT_SIZE, Math.round(sourceEdge))

            const canvas = document.createElement('canvas')
            canvas.width = outputEdge
            canvas.height = outputEdge
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Your browser could not process that image.')
            ctx.drawImage(loaded.image, sourceX, sourceY, sourceEdge, sourceEdge, 0, 0, outputEdge, outputEdge)

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
            if (!blob) throw new Error('Your browser could not process that image.')

            const updated = await uploadOwnMapScreenshot(accessToken, mapName, blob, `${mapName}.png`)
            onUploaded(updated)
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to upload the screenshot. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={displayMapName(mapName)}
            offsetSidebar
            maxWidth="460px"
            className="bg-card/98 border-hairline/5 backdrop-blur-3xl mx-auto"
            footer={null}
        >
            <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Screenshots are shown as squares across the app. Drag to reposition and zoom to
                    choose the part of the image that gets kept.
                </p>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs font-medium">
                        {error}
                    </div>
                )}

                <div className="flex flex-col items-center gap-3">
                    <div
                        ref={frameRef}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => {
                            e.preventDefault()
                            setDragOver(false)
                            accept(e.dataTransfer.files?.[0])
                        }}
                        onClick={() => { if (!loaded) inputRef.current?.click() }}
                        className={cn(
                            'relative overflow-hidden rounded-xl border select-none touch-none',
                            loaded ? 'cursor-grab active:cursor-grabbing border-accent-500/40' : 'cursor-pointer border-dashed border-hairline/20 hover:border-accent-500/40',
                            dragOver && 'border-accent-500/60',
                        )}
                        style={{ width: MAX_FRAME, height: frame, maxWidth: '100%' }}
                    >
                        {loaded ? (
                            <img
                                src={loaded.objectUrl}
                                alt=""
                                draggable={false}
                                className="absolute max-w-none origin-top-left pointer-events-none"
                                style={{
                                    width: displayedWidth,
                                    height: displayedHeight,
                                    left: offset.x,
                                    top: offset.y,
                                }}
                            />
                        ) : (
                            <>
                                {hasScreenshot && (
                                    <MapThumbnail
                                        mapName={mapName}
                                        version={screenshotVersion}
                                        size="hero"
                                        className="absolute inset-0 w-full h-full rounded-none border-0 opacity-25"
                                    />
                                )}
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                                    <ImagePlus className="size-6 text-accent-300" />
                                    <div className="text-sm font-semibold text-foreground">
                                        {hasScreenshot ? 'Drop a new screenshot' : 'Drop a screenshot'}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        or click to browse — PNG, JPG or WEBP, at least {MIN_SOURCE_EDGE} × {MIN_SOURCE_EDGE}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {loaded && (
                        <div className="w-full flex items-center gap-3" style={{ maxWidth: MAX_FRAME }}>
                            <ZoomIn className="size-3.5 text-muted-foreground shrink-0" />
                            <Slider
                                min={1}
                                max={maxZoom}
                                step={0.01}
                                value={zoom}
                                onChange={e => changeZoom(parseFloat((e.target as HTMLInputElement).value))}
                                className="h-1.5 flex-1"
                            />
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                Change image
                            </button>
                        </div>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={e => {
                        accept(e.target.files?.[0])
                        e.target.value = ''
                    }}
                />

                <Button
                    onClick={save}
                    disabled={!loaded || saving || !accessToken}
                    className="w-full h-10 bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 transition-all font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save Screenshot'}
                </Button>
            </div>
        </Modal>
    )
}
