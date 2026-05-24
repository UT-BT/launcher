import { useState } from 'react'
import { cn } from '@/lib/utils'

const FALLBACK_URL = 'https://utbt.net/images/screenshots/default.png'

interface MapThumbnailProps {
    mapName: string
    className?: string
    alt?: string
}

export function MapThumbnail({ mapName, className, alt }: MapThumbnailProps) {
    const [errored, setErrored] = useState(false)
    const src = errored ? FALLBACK_URL : `https://utbt.net/images/screenshots/${mapName}.png`
    return (
        <div className={cn(
            "overflow-hidden bg-muted/20 border border-white/10 rounded shrink-0",
            className,
        )}>
            <img
                src={src}
                alt={alt ?? mapName}
                className="w-full h-full object-cover"
                onError={() => setErrored(true)}
            />
        </div>
    )
}
