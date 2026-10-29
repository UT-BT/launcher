import { useEffect, useState, type CSSProperties } from 'react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import type { SeasonId } from '../seasons'
import { BAT_BODY, BAT_WING, MIRROR_BAT, seededRandom } from './shapes'

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

export function AmbientLayer({ season }: { season: SeasonId }) {
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
