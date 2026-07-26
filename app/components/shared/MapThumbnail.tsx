import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/app/utils/api'

interface MapThumbnailProps {
    mapName: string
    className?: string
    alt?: string
    version?: string | number | null
    fit?: 'cover' | 'blend'
}

export function MapThumbnail({ mapName, className, alt, version, fit = 'cover' }: MapThumbnailProps) {
    const [errored, setErrored] = useState(false)
    useEffect(() => setErrored(false), [mapName, version])
    const buster = version != null ? `?v=${encodeURIComponent(String(version))}` : ''
    const src = errored
        ? `${API_BASE_URL}/screenshots/default.png`
        : `${API_BASE_URL}/screenshots/${encodeURIComponent(mapName)}.png${buster}`
    return (
        <div className={cn(
            "relative overflow-hidden bg-muted/20 border border-hairline/10 rounded shrink-0",
            className,
        )}>
            {fit === 'blend' && (
                <img
                    src={src}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
                />
            )}
            <img
                src={src}
                alt={alt ?? mapName}
                loading="lazy"
                decoding="async"
                className={cn(
                    "relative w-full h-full",
                    fit === 'blend' ? "object-contain" : "object-cover",
                )}
                onError={() => setErrored(true)}
            />
        </div>
    )
}
