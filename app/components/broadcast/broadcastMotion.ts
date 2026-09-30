import type { TargetAndTransition, Transition, Variants } from 'framer-motion'

export type Bezier = [number, number, number, number]

export const EASE_OUT: Bezier = [0.22, 1, 0.36, 1]

export const EASE_IN: Bezier = [0.55, 0, 1, 0.45]

export const EASE_OVERSHOOT: Bezier = [0.34, 1.56, 0.64, 1]

export const SLAM: Bezier = [0.7, 0, 0.84, 0]

const SCENE_ENTER_S = 0.35

const SCENE_EXIT_S = 0.15

const BACKWARD_HANDOFF_S = 0.45

const CHIP_S = 0.25

const REVEAL_FLASH_S = 0.75

export const SCENE_VARIANTS: Variants = {
    hidden: (direction: number) => ({ opacity: 0, y: direction < 0 ? -12 : 12 }),
    shown: (direction: number) => ({
        opacity: 1,
        y: 0,
        transition: { duration: SCENE_ENTER_S, ease: EASE_OUT, delay: direction < 0 ? BACKWARD_HANDOFF_S : 0 },
    }),
    gone: (direction: number) => (direction < 0
        ? { opacity: 0, y: 12, transition: { duration: SCENE_EXIT_S, ease: EASE_IN, when: 'afterChildren' } }
        : { opacity: 0, transition: { duration: SCENE_EXIT_S, ease: EASE_IN } }),
}

export function staggeredCard(order: number): Variants {
    return {
        hidden: { opacity: 0, y: 16, scale: 0.96 },
        shown: { opacity: 1, y: 0, scale: 1, transition: { delay: 0.1 + order * 0.08, duration: 0.4, ease: EASE_OUT } },
    }
}

export const CHIP_MOTION = {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.6 },
    transition: { duration: CHIP_S, ease: EASE_OUT },
}

export const STAMP_MOTION = {
    initial: { opacity: 0, scale: 1.8 },
    animate: { opacity: 1, scale: 1, transition: { duration: CHIP_S, ease: SLAM } },
    exit: { opacity: 0, scale: 1.8, transition: { duration: CHIP_S, ease: EASE_IN } },
}

export const REVEAL_FLASH_MOTION = {
    initial: { opacity: 0.95 },
    animate: { opacity: 0 },
    exit: { opacity: 0 },
    transition: { duration: REVEAL_FLASH_S, ease: EASE_OUT },
}

export const REVEAL_POP: TargetAndTransition = {
    scale: [1, 1.12, 1],
    transition: { duration: REVEAL_FLASH_S * 0.6, ease: EASE_OVERSHOOT },
}

export const REVEAL_RING_MOTION = {
    initial: { opacity: 0.9, scale: 0.85 },
    animate: { opacity: 0, scale: 1.7 },
    exit: { opacity: 0 },
    transition: { duration: REVEAL_FLASH_S, ease: EASE_OUT },
}

export const FADE_MOTION = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25, ease: EASE_OUT },
}

export const INDICATOR_TRANSITION: Transition = { type: 'spring', stiffness: 520, damping: 40 }
