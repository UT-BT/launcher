import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
    SCREENSHOT_BLUR_PX,
    SCREENSHOT_SIZE_PX,
    derivedScreenshotUrl,
    nextScreenshotStage,
    screenshotUrlFor,
    type MapThumbnailSize,
    type ScreenshotStage,
} from '@/app/utils/mapScreenshots'

export type { MapThumbnailSize }

interface MapThumbnailProps {
    mapName: string
    className?: string
    alt?: string
    version?: string | number | null
    fit?: 'cover' | 'blend'
    size?: MapThumbnailSize
    priority?: boolean
}

export function MapThumbnail({
    mapName, className, alt, version, fit = 'cover', size = 'thumb', priority = false,
}: MapThumbnailProps) {
    const imageKey = `${mapName}|${version ?? ''}|${size}`
    const [fallback, setFallback] = useState({ key: imageKey, stage: 'derived' as ScreenshotStage, blurFailed: false })
    const current = fallback.key === imageKey ? fallback : { key: imageKey, stage: 'derived' as ScreenshotStage, blurFailed: false }

    const px = SCREENSHOT_SIZE_PX[size]
    const src = screenshotUrlFor(current.stage, mapName, size, version)
    const blurSrc = current.stage === 'derived' && !current.blurFailed
        ? derivedScreenshotUrl(mapName, SCREENSHOT_BLUR_PX, version)
        : src

    return (
        <div className={cn(
            "relative overflow-hidden bg-muted/20 border border-hairline/10 rounded shrink-0",
            className,
        )}>
            {fit === 'blend' && (
                <img
                    src={blurSrc}
                    alt=""
                    aria-hidden
                    width={SCREENSHOT_BLUR_PX}
                    height={SCREENSHOT_BLUR_PX}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
                    onError={() => setFallback({ ...current, blurFailed: true })}
                />
            )}
            <img
                src={src}
                alt={alt ?? mapName}
                width={px}
                height={px}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : undefined}
                decoding="async"
                className={cn(
                    "relative w-full h-full",
                    fit === 'blend' ? "object-contain" : "object-cover",
                )}
                onError={() => setFallback({ ...current, stage: nextScreenshotStage(current.stage) })}
            />
        </div>
    )
}
