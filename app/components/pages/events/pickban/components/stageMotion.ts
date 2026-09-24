import type { TargetAndTransition, Transition, Variants } from 'framer-motion'
import type { PickBanSceneDirection } from '../pickBanView'

type Bezier = [number, number, number, number]

const EASE_OUT: Bezier = [0.22, 1, 0.36, 1]

const EASE_IN: Bezier = [0.55, 0, 1, 0.45]

const EASE_OVERSHOOT: Bezier = [0.34, 1.56, 0.64, 1]

const SLAM: Bezier = [0.7, 0, 0.84, 0]

const SCENE_ENTER_S = 0.35

const SCENE_EXIT_S = 0.15

const CHIP_S = 0.25

function backwardsOnly(target: TargetAndTransition): (direction: PickBanSceneDirection) => TargetAndTransition {
    return direction => (direction < 0 ? target : {})
}

export const SCENE_VARIANTS: Variants = {
    hidden: (direction: PickBanSceneDirection) => ({ opacity: 0, y: direction < 0 ? -12 : 12 }),
    shown: { opacity: 1, y: 0, transition: { duration: SCENE_ENTER_S, ease: EASE_OUT } },
    gone: (direction: PickBanSceneDirection) => (direction < 0
        ? { opacity: 0, y: 12, transition: { duration: SCENE_EXIT_S, ease: EASE_IN, when: 'afterChildren' } }
        : { opacity: 0, transition: { duration: SCENE_EXIT_S, ease: EASE_IN } }),
}

export function choreography(entranceMs: number) {
    const seconds = entranceMs / 1000
    const forward = (start: number, length: number, ease: Bezier = EASE_OUT): Transition => ({
        delay: start * seconds,
        duration: length * seconds,
        ease,
    })
    const reverse = (start: number, length: number): Transition => ({
        delay: start * seconds,
        duration: length * seconds,
        ease: EASE_IN,
    })
    const step = (hidden: TargetAndTransition, shown: TargetAndTransition, enter: Transition, leave: Transition): Variants => ({
        hidden,
        shown: { ...shown, transition: enter },
        gone: backwardsOnly({ ...hidden, transition: leave }),
    })

    return {
        frame: step({ opacity: 0, scale: 0.7, y: 24 }, { opacity: 1, scale: 1, y: 0 }, forward(0, 0.55, EASE_OVERSHOOT), reverse(0.35, 0.45)),
        goldFrame: step({ opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1 }, forward(0, 0.6), reverse(0.35, 0.45)),
        glow: step({ opacity: 0 }, { opacity: 0.35 }, forward(0.3, 0.7), reverse(0, 0.35)),
        sheen: step({ opacity: 0 }, { opacity: 1 }, forward(0.2, 0.6), reverse(0, 0.35)),
        desaturate: step({ filter: 'grayscale(0) brightness(1)' }, { filter: 'grayscale(1) brightness(0.5)' }, forward(0.3, 0.35), reverse(0.15, 0.3)),
        stamp: step({ opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1 }, forward(0.5, 0.25, SLAM), reverse(0, 0.25)),
        badge: step({ opacity: 0, y: -12 }, { opacity: 1, y: 0 }, forward(0.45, 0.35), reverse(0, 0.25)),
        caption: step({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, forward(0.55, 0.4), reverse(0, 0.25)),
        fromLeft: step({ opacity: 0, x: -48 }, { opacity: 1, x: 0 }, forward(0, 0.65), reverse(0, 0.4)),
        fromRight: step({ opacity: 0, x: 48 }, { opacity: 1, x: 0 }, forward(0, 0.65), reverse(0, 0.4)),
        centre: step({ opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }, forward(0.3, 0.5, EASE_OVERSHOOT), reverse(0, 0.3)),
    }
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

export const FADE_MOTION = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25, ease: EASE_OUT },
}

export const INDICATOR_TRANSITION: Transition = { type: 'spring', stiffness: 520, damping: 40 }
