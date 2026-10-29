import { useId, type MouseEvent } from 'react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import type { SeasonId } from '../seasons'
import { fireBurst } from './burst'

const OUTLINE = '#111014'

function WitchHat() {
    return (
        <g transform="translate(157 96) rotate(9)" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round">
            <path d="M -47 2 C -34 -9 30 -11 49 -4 C 41 8 -30 11 -47 2 Z" fill="#221735" />
            <path d="M -22 -3 Q -14 -30 -6 -54 Q -14 -66 -36 -67 Q -16 -73 0 -60 Q 12 -32 22 -3 Q 0 1 -22 -3 Z" fill="#2c1e45" />
            <path d="M 4 -52 Q 11 -32 16 -8" fill="none" stroke="#5b3f86" strokeWidth={3} />
            <path d="M -21.5 -4 Q 0 0 21.5 -4 L 18.5 -15 Q 0 -11 -18.5 -15 Z" fill="#f97316" />
            <rect x={1} y={-15.5} width={11} height={12} rx={1.5} fill="#fbbf24" strokeWidth={3} />
            <rect x={4.5} y={-12} width={4} height={5} fill="#2c1e45" strokeWidth={1.5} />
        </g>
    )
}

function SantaHat() {
    return (
        <g transform="translate(157 95) rotate(9)" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round">
            <path d="M -38 -12 C -40 -40 -24 -58 -2 -62 C 18 -64 34 -46 40 -12 Z" fill="#dc2626" />
            <path d="M -14 -58 C -36 -68 -56 -58 -64 -40 C -61 -37 -58 -35 -54 -34 C -47 -46 -34 -52 -18 -46 Z" fill="#dc2626" />
            <path d="M 18 -54 C 30 -44 35 -30 35 -14" fill="none" stroke="#991b1b" strokeWidth={5} />
            <circle cx={-62} cy={-36} r={10} fill="#f8fafc" />
            <rect x={-45} y={-17} width={92} height={18} rx={9} fill="#f8fafc" />
            <path d="M -38 -5 Q 0 -2 40 -5" fill="none" stroke="#cbd5e1" strokeWidth={3} />
        </g>
    )
}

function Blossom({ x, y, fill, r, rotate }: { x: number; y: number; fill: string; r: number; rotate: number }) {
    return (
        <g transform={`translate(${x} ${y}) rotate(${rotate})`} stroke={OUTLINE} strokeWidth={2}>
            {[0, 72, 144, 216, 288].map(angle => (
                <ellipse key={angle} cx={0} cy={-r * 0.62} rx={r * 0.48} ry={r * 0.66} fill={fill} transform={`rotate(${angle})`} />
            ))}
            <circle r={r * 0.34} fill="#f59e0b" />
        </g>
    )
}

function Leaf({ x, y, rotate, scale = 1 }: { x: number; y: number; rotate: number; scale?: number }) {
    return (
        <path
            d="M 0 0 C 4 -5 11 -5 15 0 C 11 5 4 5 0 0 Z"
            transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
            fill="#4ade80"
            stroke={OUTLINE}
            strokeWidth={1.8}
            strokeLinejoin="round"
        />
    )
}

const VINE = 'M 120 101 C 136 90 160 89 178 95 C 188 99 195 104 200 110'

function FlowerCrown() {
    return (
        <g>
            <path d={VINE} fill="none" stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
            <path d={VINE} fill="none" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
            <Leaf x={123} y={98} rotate={-150} scale={1.1} />
            <Leaf x={149} y={88} rotate={-70} />
            <Leaf x={179} y={94} rotate={-40} />
            <Leaf x={197} y={107} rotate={30} scale={0.9} />
            <Blossom x={132} y={91} fill="#fbcfe8" r={12.5} rotate={10} />
            <Blossom x={163} y={89} fill="#fef3c7" r={13.5} rotate={-8} />
            <Blossom x={191} y={101} fill="#ddd6fe" r={11} rotate={20} />
        </g>
    )
}

const ORNAMENTS: Record<SeasonId, () => React.JSX.Element> = {
    halloween: WitchHat,
    christmas: SantaHat,
    easter: FlowerCrown,
}

export function LogoOrnament({ season, placement }: { season: SeasonId; placement: 'sidebar' | 'topbar' }) {
    const filterId = `seasonal-sticker-${useId().replace(/[^\w-]/g, '')}`
    const reducedMotion = usePrefersReducedMotion()
    const Art = ORNAMENTS[season]
    const interactive = placement === 'sidebar'

    const burst = (event: MouseEvent<SVGGElement>) => {
        if (reducedMotion) return
        const rect = event.currentTarget.getBoundingClientRect()
        fireBurst(season, rect.left + rect.width / 2, rect.top + rect.height / 2)
    }

    return (
        <svg viewBox="0 0 256 256" className="absolute inset-0 size-full overflow-visible pointer-events-none" aria-hidden="true" focusable="false">
            <defs>
                <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
                    <feMorphology in="SourceAlpha" operator="dilate" radius={3.5} result="spread" />
                    <feFlood floodColor="#f8fafc" />
                    <feComposite in2="spread" operator="in" result="edge" />
                    <feMerge>
                        <feMergeNode in="edge" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <g
                filter={`url(#${filterId})`}
                onClick={interactive ? burst : undefined}
                className={interactive ? 'cursor-pointer [pointer-events:visiblePainted]' : undefined}
            >
                <Art />
            </g>
        </svg>
    )
}
