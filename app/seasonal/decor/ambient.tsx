import { useEffect, useState, type CSSProperties } from 'react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import type { EntryId } from '../seasons'
import { BAT_BODY, BAT_WING, BLOSSOM_COLORS, FIREWORK_COLORS, GOLD_COLORS, HEART, HEART_COLORS, LANTERN_BODY, LANTERN_CAPS, LANTERN_RIBS, LANTERN_TASSEL, LEAF, LEAF_COLORS, LEAF_VEIN, MIRROR_BAT, SHAMROCK_ANGLES, SHAMROCK_COLORS, SHAMROCK_LEAF, SHAMROCK_STEM, SPARKLE, seededRandom } from './shapes'

type Vars = Record<`--${string}`, string>

function particles(seed: number, count: number, build: (random: () => number, index: number) => Vars): CSSProperties[] {
    const random = seededRandom(seed)
    return Array.from({ length: count }, (_, index) => build(random, index) as CSSProperties)
}

const FLAKES = particles(7, 16, random => {
    const duration = 12 + random() * 12
    return {
        '--x': `${(random() * 100).toFixed(1)}%`,
        '--s': `${(2 + random() * 3).toFixed(1)}px`,
        '--o': (0.35 + random() * 0.4).toFixed(2),
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--sway': `${(8 + random() * 18).toFixed(0)}px`,
        '--swayd': `${(3 + random() * 3).toFixed(1)}s`,
    }
})

const PETAL_COLORS = ['#f9a8d4', '#fbcfe8', '#fde68a', '#ddd6fe', '#bbf7d0']

const PETALS = particles(11, 10, (random, index) => {
    const duration = 18 + random() * 14
    return {
        '--x': `${(random() * 100).toFixed(1)}%`,
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--c': PETAL_COLORS[index % PETAL_COLORS.length],
        '--tumble': `${(4 + random() * 4).toFixed(1)}s`,
    }
})

const SEASON_PARTICLES = 8

const BLOSSOMS = particles(23, SEASON_PARTICLES, (random, index) => {
    const duration = 26 + random() * 16
    return {
        '--x': `${(random() * 100).toFixed(1)}%`,
        '--dx': `${(8 + random() * 14).toFixed(1)}vw`,
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--c': BLOSSOM_COLORS[index % BLOSSOM_COLORS.length],
        '--tumble': `${(5 + random() * 4).toFixed(1)}s`,
    }
})

const LEAVES = particles(31, SEASON_PARTICLES, (random, index) => {
    const duration = 20 + random() * 14
    return {
        '--x': `${(random() * 100).toFixed(1)}%`,
        '--s': `${(13 + random() * 7).toFixed(0)}px`,
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--c': LEAF_COLORS[index % LEAF_COLORS.length],
        '--swing': `${(3.5 + random() * 2.5).toFixed(1)}s`,
        '--sway': `${(18 + random() * 22).toFixed(0)}px`,
    }
})

const WINTER_FLAKES = particles(43, SEASON_PARTICLES, random => {
    const duration = 24 + random() * 14
    return {
        '--x': `${(random() * 100).toFixed(1)}%`,
        '--s': `${(2 + random() * 1.8).toFixed(1)}px`,
        '--o': (0.3 + random() * 0.25).toFixed(2),
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--sway': `${(6 + random() * 12).toFixed(0)}px`,
        '--swayd': `${(4 + random() * 3).toFixed(1)}s`,
    }
})

const TWINKLES = particles(53, SEASON_PARTICLES, (random, index) => {
    const duration = 7 + random() * 6
    return {
        '--x': `${(4 + random() * 92).toFixed(1)}%`,
        '--y': `${(6 + random() * 58).toFixed(1)}%`,
        '--s': `${(7 + random() * 5).toFixed(0)}px`,
        '--o': (0.35 + random() * 0.25).toFixed(2),
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--c': GOLD_COLORS[index % GOLD_COLORS.length],
    }
})

const BLOOM_SPARKS = 8

const BLOOMS: Vars[] = [
    { '--x': '30%', '--y': '16%', '--hx1': '38vw', '--hy1': '8vh', '--hx2': '18vw', '--hy2': '-6vh', '--r': '44px', '--o': '0.5', '--d': '11s', '--delay': '-1.5s', '--c': FIREWORK_COLORS[0] },
    { '--x': '80%', '--y': '26%', '--hx1': '-34vw', '--hy1': '-12vh', '--hx2': '-18vw', '--hy2': '4vh', '--r': '36px', '--o': '0.45', '--d': '14s', '--delay': '-8s', '--c': FIREWORK_COLORS[1] },
]

const SPARK_ANGLES = Array.from({ length: BLOOM_SPARKS }, (_, index) => ({ '--a': `${(index * 360) / BLOOM_SPARKS}deg` }) as CSSProperties)

const LANTERNS = particles(67, 6, random => {
    const duration = 34 + random() * 16
    return {
        '--x': `${(4 + random() * 90).toFixed(1)}%`,
        '--s': `${(14 + random() * 8).toFixed(0)}px`,
        '--o': (0.4 + random() * 0.2).toFixed(2),
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--sway': `${(8 + random() * 14).toFixed(0)}px`,
        '--swayd': `${(4 + random() * 3).toFixed(1)}s`,
    }
})

const HEARTS = particles(79, 8, (random, index) => {
    const duration = 16 + random() * 10
    return {
        '--x': `${(4 + random() * 92).toFixed(1)}%`,
        '--y': `${(45 + random() * 45).toFixed(1)}%`,
        '--s': `${(10 + random() * 8).toFixed(0)}px`,
        '--o': (0.3 + random() * 0.2).toFixed(2),
        '--rise': `${(28 + random() * 18).toFixed(0)}vh`,
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--c': HEART_COLORS[index % HEART_COLORS.length],
        '--sway': `${(6 + random() * 10).toFixed(0)}px`,
        '--swayd': `${(3 + random() * 2.5).toFixed(1)}s`,
    }
})

const SHAMROCKS = particles(83, 8, (random, index) => {
    const duration = 26 + random() * 14
    return {
        '--x': `${(random() * 96).toFixed(1)}%`,
        '--s': `${(12 + random() * 7).toFixed(0)}px`,
        '--o': (0.35 + random() * 0.2).toFixed(2),
        '--dx': `${(-10 + random() * 20).toFixed(1)}vw`,
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
        '--c': SHAMROCK_COLORS[index % SHAMROCK_COLORS.length],
        '--tumble': `${(5 + random() * 4).toFixed(1)}s`,
        '--sway': `${(14 + random() * 16).toFixed(0)}px`,
    }
})

const GOLD_GLINTS = particles(89, 6, random => {
    const duration = 6 + random() * 5
    return {
        '--x': `${(4 + random() * 92).toFixed(1)}%`,
        '--y': `${(6 + random() * 80).toFixed(1)}%`,
        '--s': `${(5 + random() * 4).toFixed(0)}px`,
        '--o': (0.25 + random() * 0.2).toFixed(2),
        '--d': `${duration.toFixed(1)}s`,
        '--delay': `${(-random() * duration).toFixed(1)}s`,
    }
})

const BATS: Vars[] = [
    { '--y': '16%', '--dy': '-5vh', '--d': '27s', '--delay': '-2s', '--s': '34px', '--from': '-8vw', '--span': '116vw', '--swoopd': '3.7s', '--flutd': '1.1s', '--bankd': '1.7s', '--flapd': '0.12s' },
    { '--y': '33%', '--dy': '6vh', '--d': '35s', '--delay': '-16s', '--s': '24px', '--from': '108vw', '--span': '-116vw', '--swoopd': '4.3s', '--flutd': '0.9s', '--bankd': '2.1s', '--flapd': '0.14s' },
    { '--y': '10%', '--dy': '9vh', '--d': '43s', '--delay': '-30s', '--s': '20px', '--from': '-8vw', '--span': '116vw', '--swoopd': '3.1s', '--flutd': '1.3s', '--bankd': '1.5s', '--flapd': '0.11s' },
]

const BUTTERFLY: Vars = { '--y': '24%', '--dy': '-8vh', '--d': '64s', '--delay': '-4s', '--s': '24px', '--from': '-6vw', '--span': '112vw' }

function Bat({ style }: { style: Vars }) {
    return (
        <span className="seasonal-bat" style={style as CSSProperties}>
            <span className="seasonal-swoop">
                <span className="seasonal-flutter">
                    <span className="seasonal-bank">
                        <span className="seasonal-wing-l">
                            <svg viewBox="0 0 40 20">
                                <path d={BAT_WING} />
                            </svg>
                        </span>
                        <span className="seasonal-wing-r">
                            <svg viewBox="0 0 40 20">
                                <path d={BAT_WING} transform={MIRROR_BAT} />
                            </svg>
                        </span>
                        <svg viewBox="0 0 40 20">
                            <path d={BAT_BODY} />
                        </svg>
                    </span>
                </span>
            </span>
        </span>
    )
}

function Butterfly({ style }: { style: Vars }) {
    return (
        <span className="seasonal-bfly" style={style as CSSProperties}>
            <span className="seasonal-meander">
                <span className="seasonal-hop">
                    <span className="seasonal-tilt">
                        <span className="seasonal-bwings">
                            <svg viewBox="0 0 24 20" strokeWidth={0.6} stroke="#6d28d9">
                                <path d="M12 9.5 C9 1 1 -0.5 1 5.5 C1 10 7 11 12 10 Z" fill="#c4b5fd" />
                                <path d="M12 9.5 C15 1 23 -0.5 23 5.5 C23 10 17 11 12 10 Z" fill="#c4b5fd" />
                                <path d="M12 10.5 C8 12.5 3.5 16.5 5.5 18.8 C8 20 11 15 12 10.5 Z" fill="#fde68a" />
                                <path d="M12 10.5 C16 12.5 20.5 16.5 18.5 18.8 C16 20 13 15 12 10.5 Z" fill="#fde68a" />
                                <circle cx={5.5} cy={5} r={1.3} fill="#f5f3ff" stroke="none" />
                                <circle cx={18.5} cy={5} r={1.3} fill="#f5f3ff" stroke="none" />
                            </svg>
                        </span>
                        <svg viewBox="0 0 24 20" fill="none" stroke="#3f3f46" strokeLinecap="round">
                            <path d="M12 6 L12 15.5" strokeWidth={1.6} />
                            <path d="M12 6 Q11 3 9.5 1.8 M12 6 Q13 3 14.5 1.8" strokeWidth={0.7} />
                        </svg>
                    </span>
                </span>
            </span>
        </span>
    )
}

function isPaused(): boolean {
    return document.hidden || !document.hasFocus()
}

function usePaused(): boolean {
    const [paused, setPaused] = useState(isPaused)
    useEffect(() => {
        const update = () => setPaused(isPaused())
        window.addEventListener('focus', update)
        window.addEventListener('blur', update)
        document.addEventListener('visibilitychange', update)
        return () => {
            window.removeEventListener('focus', update)
            window.removeEventListener('blur', update)
            document.removeEventListener('visibilitychange', update)
        }
    }, [])
    return paused
}

export function AmbientLayer({ season }: { season: EntryId }) {
    const reducedMotion = usePrefersReducedMotion()
    const paused = usePaused()
    if (reducedMotion) return null

    return (
        <div className="seasonal-layer" data-season-layer={season} data-paused={paused ? '' : undefined} aria-hidden="true">
            {season === 'halloween' && (
                <>
                    <div className="seasonal-fog" />
                    {BATS.map((style, index) => (
                        <Bat key={index} style={style} />
                    ))}
                </>
            )}
            {season === 'christmas' &&
                FLAKES.map((style, index) => (
                    <span key={index} className="seasonal-flake" style={style}>
                        <i />
                    </span>
                ))}
            {season === 'spring' &&
                BLOSSOMS.map((style, index) => (
                    <span key={index} className="seasonal-blossom" style={style}>
                        <i />
                    </span>
                ))}
            {season === 'summer' && <div className="seasonal-rays" />}
            {season === 'autumn' &&
                LEAVES.map((style, index) => (
                    <span key={index} className="seasonal-leaf" style={style}>
                        <i>
                            <svg viewBox="0 0 24 24">
                                <path d={LEAF} />
                                <path d={LEAF_VEIN} />
                            </svg>
                        </i>
                    </span>
                ))}
            {season === 'winter' && (
                <>
                    <div className="seasonal-icicles">
                        <i />
                    </div>
                    {WINTER_FLAKES.map((style, index) => (
                        <span key={index} className="seasonal-flake" style={style}>
                            <i />
                        </span>
                    ))}
                </>
            )}
            {season === 'christmas-summer' && (
                <>
                    <div className="seasonal-rays" />
                    {TWINKLES.map((style, index) => (
                        <span key={index} className="seasonal-twinkle" style={style}>
                            <svg viewBox="0 0 24 24">
                                <path d={SPARKLE} />
                            </svg>
                        </span>
                    ))}
                </>
            )}
            {season === 'new-year' &&
                BLOOMS.map((style, index) => (
                    <span key={index} className="seasonal-bloom" style={style as CSSProperties}>
                        <i>
                            {SPARK_ANGLES.map((angle, spark) => (
                                <b key={spark} style={angle} />
                            ))}
                        </i>
                    </span>
                ))}
            {season === 'lunar-new-year' &&
                LANTERNS.map((style, index) => (
                    <span key={index} className="seasonal-lantern" style={style}>
                        <i>
                            <svg viewBox="0 0 24 32">
                                <path d={LANTERN_TASSEL} />
                                <path d={LANTERN_BODY} />
                                <path d={LANTERN_RIBS} />
                                <path d={LANTERN_CAPS} />
                            </svg>
                        </i>
                    </span>
                ))}
            {season === 'valentines' &&
                HEARTS.map((style, index) => (
                    <span key={index} className="seasonal-heart" style={style}>
                        <i>
                            <svg viewBox="0 0 24 24">
                                <path d={HEART} />
                            </svg>
                        </i>
                    </span>
                ))}
            {season === 'st-patricks' && (
                <>
                    {SHAMROCKS.map((style, index) => (
                        <span key={index} className="seasonal-shamrock" style={style}>
                            <i>
                                <svg viewBox="0 0 24 24">
                                    {SHAMROCK_ANGLES.map(angle => (
                                        <path key={angle} d={SHAMROCK_LEAF} transform={`rotate(${angle} 12 12)`} />
                                    ))}
                                    <path d={SHAMROCK_STEM} fill="none" strokeWidth={1.6} strokeLinecap="round" />
                                </svg>
                            </i>
                        </span>
                    ))}
                    {GOLD_GLINTS.map((style, index) => (
                        <span key={index} className="seasonal-gold-glint" style={style}>
                            <svg viewBox="0 0 24 24">
                                <path d={SPARKLE} />
                            </svg>
                        </span>
                    ))}
                </>
            )}
            {season === 'easter' && (
                <>
                    {PETALS.map((style, index) => (
                        <span key={index} className="seasonal-petal" style={style}>
                            <i />
                        </span>
                    ))}
                    <Butterfly style={BUTTERFLY} />
                </>
            )}
        </div>
    )
}
