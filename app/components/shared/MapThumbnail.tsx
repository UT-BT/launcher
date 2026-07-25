import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/app/utils/api'

interface MapThumbnailProps {
    mapName: string
    className?: string
    alt?: string
    version?: string | number | null
}

export function MapThumbnail({ mapName, className, alt, version }: MapThumbnailProps) {
    const [errored, setErrored] = useState(false)
    useEffect(() => setErrored(false), [mapName, version])
    const buster = version != null ? `?v=${encodeURIComponent(String(version))}` : ''
    const src = errored
        ? `${API_BASE_URL}/screenshots/default.png`
        : `${API_BASE_URL}/screenshots/${encodeURIComponent(mapName)}.png${buster}`
    return (
        <div className={cn(
            "overflow-hidden bg-muted/20 border border-hairline/10 rounded shrink-0",
            className,
        )}>
            <img
                src={src}
                alt={alt ?? mapName}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                onError={() => setErrored(true)}
            />
        </div>
    )
}
