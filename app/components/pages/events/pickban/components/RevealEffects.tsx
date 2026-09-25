import type { ReactNode } from 'react'
import { motion, type TargetAndTransition, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

const CENTRED = 'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'

const PARTICLE_FIELD = cn(CENTRED, 'size-[100px] scale-[1.44] @md/stage:scale-[1.92] @3xl/stage:scale-[2.4] @[80rem]/stage:scale-[3.84]')

const RIBBON_TEXT = 'text-[10px] @md/stage:text-xs @3xl/stage:text-sm @[80rem]/stage:text-2xl'

const CONFETTI_TINTS = ['bg-pickban-gold', 'bg-white', 'bg-amber-200']

const CRACKS = [
    'M50 50 L38 41 L31 43 L19 30 L6 27',
    'M50 50 L57 38 L55 29 L63 17 L61 3',
    'M50 50 L64 53 L72 47 L86 52 L98 46',
    'M50 50 L55 63 L66 70 L70 84 L79 97',
    'M50 50 L41 60 L42 71 L30 80 L24 96',
    'M50 50 L36 52 L27 61 L12 60 L2 68',
    'M38 41 L41 30 L36 21',
    'M64 53 L70 63 L81 66',
]

function tint(hue: string, percent: number): string {
    return `color-mix(in srgb, ${hue} ${percent}%, transparent)`
}

export function Aura({ variants, hue, className }: { variants: Variants; hue: string; className?: string }) {
    return (
        <motion.span
            aria-hidden
            variants={variants}
            className={cn(CENTRED, 'size-[210%] rounded-full', className)}
            style={{ background: `radial-gradient(circle, ${tint(hue, 60)} 0%, ${tint(hue, 22)} 32%, transparent 64%)` }}
        />
    )
}

export function Shockwave({ variants, hue }: { variants: Variants; hue: string }) {
    return (
        <motion.span
            aria-hidden
            variants={variants}
            className="pointer-events-none absolute inset-0 rounded-full border-[3px]"
            style={{ borderColor: hue, boxShadow: `0 0 28px ${hue}, inset 0 0 18px ${tint(hue, 60)}` }}
        />
    )
}

export function Rays({ variants, turn }: { variants: Variants; turn: TargetAndTransition }) {
    return (
        <motion.span aria-hidden variants={variants} className={cn(CENTRED, 'size-[300%]')}>
            <motion.span
                initial={{ rotate: 0 }}
                animate={turn}
                className="block size-full rounded-full"
                style={{
                    background: `repeating-conic-gradient(from 0deg, ${tint('var(--color-pickban-gold)', 42)} 0deg 5deg, transparent 5deg 15deg)`,
                    maskImage: 'radial-gradient(circle, black 16%, transparent 60%)',
                }}
            />
        </motion.span>
    )
}

export function Flash({ variants, className, color }: { variants: Variants; className?: string; color?: string }) {
    return (
        <motion.span
            aria-hidden
            variants={variants}
            className={cn('pointer-events-none absolute inset-0', className)}
            style={color ? { backgroundColor: color } : undefined}
        />
    )
}

export function SparkBurst({ sparks, hue }: { sparks: Variants[]; hue: string }) {
    return (
        <span aria-hidden className={PARTICLE_FIELD}>
            {sparks.map((variants, index) => (
                <motion.span
                    key={index}
                    variants={variants}
                    className="absolute left-1/2 top-1/2 -ml-2 -mt-px h-0.5 w-4 rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${hue} 45%, white)`, boxShadow: `0 0 6px ${hue}` }}
                />
            ))}
        </span>
    )
}

export function ConfettiBurst({ confetti }: { confetti: Variants[] }) {
    return (
        <span aria-hidden className={PARTICLE_FIELD}>
            {confetti.map((variants, index) => (
                <motion.span
                    key={index}
                    variants={variants}
                    className={cn('absolute left-1/2 top-1/2 -ml-[2px] -mt-[3.5px] h-[7px] w-1 rounded-[1px]', CONFETTI_TINTS[index % CONFETTI_TINTS.length])}
                />
            ))}
        </span>
    )
}

export function Strike({ slash, crack, hue, cracks }: { slash: Variants; crack: Variants; hue: string; cracks: boolean }) {
    return (
        <>
            {cracks && (
                <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
                    {CRACKS.map(path => (
                        <motion.path
                            key={path}
                            d={path}
                            variants={crack}
                            fill="none"
                            stroke="white"
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))}
                </svg>
            )}
            <motion.span
                aria-hidden
                variants={slash}
                className="pointer-events-none absolute left-[-10%] top-[12%] h-[2.5%] w-[142%] origin-left rotate-[32deg] rounded-full bg-white"
                style={{ boxShadow: `0 0 14px 4px ${hue}, 0 0 3px 1px white` }}
            />
        </>
    )
}

export function Ribbon({ strip, hue, dark = false, children }: {
    strip: Variants
    hue: string
    dark?: boolean
    children: ReactNode
}) {
    return (
        <div className="pointer-events-none absolute inset-x-[-9%] bottom-[8%] flex justify-center">
            <motion.span
                aria-hidden
                variants={strip}
                className="absolute inset-0 origin-left -skew-x-12 rounded-sm"
                style={{ backgroundColor: hue, boxShadow: `0 6px 24px ${tint(hue, 55)}` }}
            />
            <span
                className={cn(
                    'relative block max-w-full truncate px-3 py-1 font-black uppercase tracking-[0.12em] @[80rem]/stage:py-2',
                    RIBBON_TEXT,
                    dark ? 'text-neutral-950' : 'text-white',
                )}
            >
                {children}
            </span>
        </div>
    )
}
