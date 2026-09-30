import logo from '@/app/assets/logo.webp'
import { cn } from '@/lib/utils'
import { BROADCAST_SURFACE, PICK_BAN_HUES, PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { STINGER_BEATS, STINGER_EVENT_NAME, beatAnimation } from './stingerTimeline'
import './stinger.css'

const SLAB_WIDTH = 1180

const SLANT = 260

const EDGE = 16

const PLATE_SLANT = 56

const SURFACE = '#05070c'

const GRID = 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)'

function mix(hue: string, percent: number): string {
    return `color-mix(in srgb, ${hue} ${percent}%, ${SURFACE})`
}

function SlabTexture({ fade }: { fade: 'left' | 'right' }) {
    return (
        <>
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: GRID,
                    backgroundSize: '64px 64px',
                    maskImage: `linear-gradient(to ${fade}, black, transparent 85%)`,
                }}
            />
            <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.55)]" />
        </>
    )
}

function SlabA() {
    const hue = PICK_BAN_HUES.a
    return (
        <div className="absolute inset-0" style={{ animation: beatAnimation('stinger-slab-a-out', STINGER_BEATS.slabsOut) }}>
            <div
                className="absolute inset-y-0 left-0"
                style={{
                    width: SLAB_WIDTH,
                    clipPath: `polygon(0 0, 100% 0, calc(100% - ${SLANT}px) 100%, 0 100%)`,
                    background: `linear-gradient(100deg, ${mix(hue, 30)} 0%, ${mix(hue, 70)} 45%, ${hue} 100%)`,
                    animation: beatAnimation('stinger-slab-a-in', STINGER_BEATS.slabAIn),
                }}
            >
                <SlabTexture fade="left" />
                <div
                    className={cn('absolute inset-0', PICK_BAN_TONES.gold.solid)}
                    style={{ clipPath: `polygon(calc(100% - ${EDGE}px) 0, 100% 0, calc(100% - ${SLANT}px) 100%, calc(100% - ${SLANT + EDGE}px) 100%)` }}
                />
            </div>
        </div>
    )
}

function SlabB() {
    const hue = PICK_BAN_HUES.b
    return (
        <div className="absolute inset-0" style={{ animation: beatAnimation('stinger-slab-b-out', STINGER_BEATS.slabsOut) }}>
            <div
                className="absolute inset-y-0 right-0"
                style={{
                    width: SLAB_WIDTH,
                    clipPath: `polygon(${SLANT}px 0, 100% 0, 100% 100%, 0 100%)`,
                    background: `linear-gradient(280deg, ${mix(hue, 30)} 0%, ${mix(hue, 70)} 45%, ${hue} 100%)`,
                    animation: beatAnimation('stinger-slab-b-in', STINGER_BEATS.slabBIn),
                }}
            >
                <SlabTexture fade="right" />
            </div>
        </div>
    )
}

function SeamFlash() {
    return (
        <div
            className="absolute"
            style={{
                left: SLAB_WIDTH - SLANT / 2 - 600,
                top: -60,
                width: 1200,
                height: 1200,
                background: `radial-gradient(closest-side, rgba(255,255,255,0.5), ${PICK_BAN_HUES.gold} 25%, transparent 100%)`,
                mixBlendMode: 'screen',
                animation: beatAnimation('stinger-flash', STINGER_BEATS.flash),
            }}
        />
    )
}

function Brand({ eventName }: { eventName: string }) {
    return (
        <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: beatAnimation('stinger-brand-out', STINGER_BEATS.brandOut) }}
        >
            <div
                className={cn('relative flex items-center gap-12 py-12 pr-28 pl-24', BROADCAST_SURFACE)}
                style={{
                    clipPath: `polygon(${PLATE_SLANT}px 0, 100% 0, calc(100% - ${PLATE_SLANT}px) 100%, 0 100%)`,
                    animation: beatAnimation('stinger-plate-in', STINGER_BEATS.plateIn),
                }}
            >
                <div className={cn('absolute inset-x-0 top-0 h-1', PICK_BAN_TONES.gold.solid)} />
                <div className={cn('absolute inset-x-0 bottom-0 h-1', PICK_BAN_TONES.gold.solid)} />
                <img
                    src={logo}
                    alt=""
                    className="size-48 drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
                    style={{ animation: beatAnimation('stinger-logo-in', STINGER_BEATS.logoIn) }}
                />
                <div style={{ animation: beatAnimation('stinger-title-in', STINGER_BEATS.titleIn) }}>
                    <p className="text-[104px] leading-none font-black whitespace-nowrap uppercase italic">{eventName}</p>
                    <p className="mt-5 text-[28px] leading-none font-semibold tracking-[0.3em] text-white/60 uppercase">utbt.net</p>
                </div>
            </div>
        </div>
    )
}

export function Stinger({ eventName = STINGER_EVENT_NAME }: { eventName?: string }) {
    return (
        <div aria-hidden data-motion="on" className="pointer-events-none absolute inset-0 overflow-hidden font-pickban text-white">
            <SlabB />
            <SlabA />
            <SeamFlash />
            <Brand eventName={eventName} />
        </div>
    )
}
