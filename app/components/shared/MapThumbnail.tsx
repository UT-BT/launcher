import { useEffect, useState } from 'react'
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
    /** Above the fold: load eagerly at high priority instead of lazily. */
    priority?: boolean
}

/**
 * Deliberately not a <picture> element: <source> only falls back when the type
 * is unsupported, never on a 404. Derivative writes are best-effort on the API
 * side, so a WebP can be absent while the PNG is fine — which <picture> would
 * render as a broken image. The onError chain handles it instead.
 */
export function MapThumbnail({
    mapName, className, alt, version, fit = 'cover', size = 'thumb', priority = false,
}: MapThumbnailProps) {
    const [stage, setStage] = useState<ScreenshotStage>('derived')
    useEffect(() => setStage('derived'), [mapName, version, size])

    const px = SCREENSHOT_SIZE_PX[size]
    const src = screenshotUrlFor(stage, mapName, size, version)
    const blurSrc = stage === 'derived'
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
                onError={() => setStage(nextScreenshotStage)}
            />
        </div>
    )
}
