import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint } from '@/app/components/broadcast/broadcastTone'
import type { NextMapMedia, NextMapShown } from './nextMapView'

const PAN_SECONDS = 26

function MapVideo({ src, playing, onFailed }: { src: string; playing: boolean; onFailed: (src: string) => void }) {
    const ref = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        const video = ref.current
        if (!video) return
        video.muted = true
        if (playing) video.play().catch(() => undefined)
        else video.pause()
    }, [src, playing])

    return (
        <video
            ref={ref}
            data-next-map-video
            src={src}
            muted
            loop
            playsInline
            autoPlay={playing}
            preload="auto"
            disablePictureInPicture
            onError={() => onFailed(src)}
            className="absolute inset-0 size-full object-cover"
        />
    )
}

function MapScreenshot({ map, version, pan }: { map: string; version: string | null; pan: boolean }) {
    const image = <MapThumbnail mapName={map} version={version} size="hero" alt="" priority className="absolute inset-0 size-full rounded-none border-0" />

    if (!pan) {
        return (
            <div data-next-map-screenshot="still" className="absolute inset-0 scale-110">
                {image}
            </div>
        )
    }
    return (
        <motion.div
            data-next-map-screenshot="pan"
            className="absolute inset-0"
            initial={{ scale: 1.12, x: '-3%' }}
            animate={{ scale: 1.12, x: '3%' }}
            transition={{ duration: PAN_SECONDS, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
        >
            {image}
        </motion.div>
    )
}

function HeroMedia({ media, onVideoFailed }: { media: NextMapMedia; onVideoFailed: (src: string) => void }) {
    if (media.kind === 'video') return <MapVideo src={media.src} playing={media.playing} onFailed={onVideoFailed} />
    if (media.kind === 'screenshot') return <MapScreenshot map={media.map} version={media.version} pan={media.pan} />
    return null
}

export function NextMapHero({ next, onVideoFailed }: { next: NextMapShown; onVideoFailed: (src: string) => void }) {
    const hue = PICK_BAN_HUES[next.tone]
    const classes = PICK_BAN_TONES[next.tone]

    return (
        <div
            data-next-map-hero={next.media.kind}
            className="relative h-[720px] w-[1280px] shrink-0 overflow-hidden rounded-3xl border-4 bg-white/5"
            style={{ borderColor: hue, boxShadow: `0 0 48px ${tint(hue, 30)}, 0 24px 60px rgba(0,0,0,0.55)` }}
        >
            <HeroMedia media={next.media} onVideoFailed={onVideoFailed} />
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
            <span
                className={cn(
                    'absolute left-7 top-6 flex items-center gap-2.5 rounded-xl px-5 py-2 text-[34px] font-black italic uppercase leading-none shadow-lg',
                    classes.solid,
                    classes.onSolid,
                )}
            >
                {next.decider && <Star className="size-[0.9em] fill-current" />}
                Map {next.number}
            </span>
        </div>
    )
}
