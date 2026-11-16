import type { TargetAndTransition, Variants } from 'framer-motion'
import { EASE_OUT, SLAM } from '@/app/components/broadcast/broadcastMotion'

export const BEATS = {
    trophy: 0.3,
    kicker: 0.6,
    name: 0.78,
    champions: 1.02,
    score: 1.26,
    podium: 1.4,
    message: 1.6,
    actions: 1.76,
}

const SPARK_COUNT = 16

const CONFETTI_COUNT = 40

const RAYS_TURN_S = 80

function scatter(index: number, spread: number): number {
    const seed = Math.sin(index * 12.9898 + spread * 78.233) * 43758.5453
    return seed - Math.floor(seed)
}

export const backdrop: Variants = {
    hidden: { opacity: 0 },
    shown: { opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
}

export const panel: Variants = {
    hidden: { opacity: 0, scale: 0.94, y: 16 },
    shown: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
}

export function rise(at: number, lift = 14): Variants {
    return {
        hidden: { opacity: 0, y: lift },
        shown: { opacity: 1, y: 0, transition: { delay: at, duration: 0.5, ease: EASE_OUT } },
    }
}

export function rule(at: number): Variants {
    return {
        hidden: { opacity: 0, scaleX: 0 },
        shown: { opacity: 1, scaleX: 1, transition: { delay: at, duration: 0.7, ease: EASE_OUT } },
    }
}

export function slam(at: number): Variants {
    return {
        hidden: { opacity: 0, scale: 1.7, rotate: -10 },
        shown: {
            opacity: 1,
            scale: [1.7, 0.92, 1.04, 1],
            rotate: [-10, 2, 0, 0],
            transition: {
                delay: at,
                duration: 0.55,
                times: [0, 0.55, 0.8, 1],
                ease: [SLAM, EASE_OUT, EASE_OUT],
                opacity: { delay: at, duration: 0.18 },
            },
        },
    }
}

export function stamp(at: number): Variants {
    return {
        hidden: { opacity: 0, scale: 1.35 },
        shown: { opacity: 1, scale: 1, transition: { delay: at, duration: 0.32, ease: SLAM } },
    }
}

export function shockwave(at: number): Variants {
    return {
        hidden: { opacity: 0, scale: 0.7 },
        shown: {
            opacity: [0, 0.9, 0],
            scale: [0.7, 0.9, 2.8],
            transition: { delay: at, duration: 0.8, times: [0, 0.08, 1], ease: EASE_OUT },
        },
    }
}

export function aura(at: number): Variants {
    return {
        hidden: { opacity: 0, scale: 0.4 },
        shown: {
            opacity: [0, 1, 0.75],
            scale: [0.4, 1.25, 1],
            transition: { delay: at, duration: 1, times: [0, 0.35, 1], ease: EASE_OUT },
        },
    }
}

export function rays(at: number): Variants {
    return {
        hidden: { opacity: 0, scale: 0.5 },
        shown: { opacity: 1, scale: 1, transition: { delay: at, duration: 1.1, ease: EASE_OUT } },
    }
}

export const RAYS_TURN: TargetAndTransition = {
    rotate: 360,
    transition: { duration: RAYS_TURN_S, ease: 'linear', repeat: Infinity },
}

export function sparks(at: number): Variants[] {
    return Array.from({ length: SPARK_COUNT }, (_, index): Variants => {
        const angle = (index / SPARK_COUNT) * 360 + (scatter(index, 1) - 0.5) * 16
        const radians = (angle * Math.PI) / 180
        const reach = 74 + scatter(index, 2) * 46
        const length = 0.45 + scatter(index, 3) * 0.2
        return {
            hidden: { opacity: 0, x: 0, y: 0, rotate: angle, scaleX: 0.4 },
            shown: {
                opacity: [0, 1, 1, 0],
                x: [Math.cos(radians) * 30, Math.cos(radians) * reach],
                y: [Math.sin(radians) * 30, Math.sin(radians) * reach],
                rotate: angle,
                scaleX: [0.4, 1.4, 0.3],
                transition: {
                    delay: at,
                    duration: length,
                    ease: EASE_OUT,
                    opacity: { delay: at, duration: length, times: [0, 0.1, 0.6, 1] },
                    scaleX: { delay: at, duration: length, times: [0, 0.3, 1] },
                },
            },
        }
    })
}

export function confetti(at: number): Variants[] {
    return Array.from({ length: CONFETTI_COUNT }, (_, index): Variants => {
        const angle = -Math.PI / 2 + (scatter(index, 4) - 0.5) * Math.PI * 1.5
        const reach = 90 + scatter(index, 5) * 170
        const x = Math.cos(angle) * reach
        const lift = Math.sin(angle) * reach * 0.8 - 30
        const fall = lift + 260 + scatter(index, 6) * 220
        const length = 1.9 + scatter(index, 8) * 0.9
        return {
            hidden: { opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.4 },
            shown: {
                opacity: [0, 1, 1, 0],
                x: [0, x, x * 1.18],
                y: [0, lift, fall],
                rotate: (scatter(index, 7) - 0.5) * 900,
                scale: [0.4, 1, 0.9],
                transition: {
                    delay: at + (index % 5) * 0.03,
                    duration: length,
                    ease: 'linear',
                    opacity: { delay: at, duration: length, times: [0, 0.04, 0.75, 1] },
                    x: { delay: at, duration: length, times: [0, 0.22, 1], ease: EASE_OUT },
                    y: { delay: at, duration: length, times: [0, 0.22, 1], ease: [EASE_OUT, [0.4, 0, 0.9, 0.6]] },
                },
            },
        }
    })
}
