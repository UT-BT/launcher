import type { TargetAndTransition, Transition, Variants } from 'framer-motion'
import { DECIDER_IMPACT, IMPACT, STAMP_HIT, VS_HIT } from '../pickBanBeats'
import type { PickBanSceneDirection } from '../pickBanView'

type Bezier = [number, number, number, number]

const EASE_OUT: Bezier = [0.22, 1, 0.36, 1]

const EASE_IN: Bezier = [0.55, 0, 1, 0.45]

const EASE_OVERSHOOT: Bezier = [0.34, 1.56, 0.64, 1]

const SLAM: Bezier = [0.7, 0, 0.84, 0]

const SCENE_ENTER_S = 0.35

const SCENE_EXIT_S = 0.15

const BACKWARD_HANDOFF_S = 0.45

const CHIP_S = 0.25

const REVEAL_FLASH_S = 0.75

const SHAKE_X = [0, -10, 9, -6, 4, -2, 0]

const SPARK_COUNT = 18

const CONFETTI_COUNT = 24

const LETTER_SPREAD_EM = 0.9

const RAYS_TURN_S = 90

function backwardsOnly(target: TargetAndTransition): (direction: PickBanSceneDirection) => TargetAndTransition {
    return direction => (direction < 0 ? target : {})
}

function scatter(index: number, spread: number): number {
    const seed = Math.sin(index * 12.9898 + spread * 78.233) * 43758.5453
    return seed - Math.floor(seed)
}

export const SCENE_VARIANTS: Variants = {
    hidden: (direction: PickBanSceneDirection) => ({ opacity: 0, y: direction < 0 ? -12 : 12 }),
    shown: (direction: PickBanSceneDirection) => ({
        opacity: 1,
        y: 0,
        transition: { duration: SCENE_ENTER_S, ease: EASE_OUT, delay: direction < 0 ? BACKWARD_HANDOFF_S : 0 },
    }),
    gone: (direction: PickBanSceneDirection) => (direction < 0
        ? { opacity: 0, y: 12, transition: { duration: SCENE_EXIT_S, ease: EASE_IN, when: 'afterChildren' } }
        : { opacity: 0, transition: { duration: SCENE_EXIT_S, ease: EASE_IN } }),
}

export function choreography(entranceMs: number) {
    const seconds = entranceMs / 1000
    const forward = (start: number, length: number, ease: Bezier | 'linear' = EASE_OUT, times?: number[]): Transition => ({
        delay: start * seconds,
        duration: length * seconds,
        ease,
        ...(times ? { times } : {}),
    })
    const reverse = (start: number, length: number): Transition => ({
        delay: start * seconds,
        duration: length * seconds,
        ease: EASE_IN,
    })
    const step = (hidden: TargetAndTransition, shown: TargetAndTransition, enter: Transition, leave: Transition = reverse(0, 0.2)): Variants => ({
        hidden,
        shown: { ...shown, transition: enter },
        gone: backwardsOnly({ ...hidden, transition: leave }),
    })
    const shake = (at: number, strength = 1) => step({ x: 0 }, { x: SHAKE_X.map(offset => offset * strength) }, forward(at, 0.24, 'linear'))
    const slam = (tilt: number) => step(
        { opacity: 0, scale: 1.5, rotate: tilt },
        { opacity: 1, scale: [1.5, 0.94, 1.03, 1], rotate: [tilt, -tilt / 6, 0, 0] },
        { ...forward(0, IMPACT / 0.6, 'linear', [0, 0.6, 0.82, 1]), ease: [SLAM, EASE_OUT, EASE_OUT], opacity: forward(0, IMPACT * 0.45) },
        reverse(0.05, 0.2),
    )
    const shockwave = (at: number) => step({ opacity: 0, scale: 0.7 }, { opacity: [0, 0.95, 0], scale: [0.7, 0.8, 2.4] }, forward(at, 0.42, EASE_OUT, [0, 0.06, 1]))
    const flash = (at: number, peak: number) => step({ opacity: 0 }, { opacity: [0, peak, 0] }, forward(at, 0.36, 'linear', [0, 0.12, 1]))
    const sparks = Array.from({ length: SPARK_COUNT }, (_, index): Variants => {
        const angle = (index / SPARK_COUNT) * 360 + (scatter(index, 1) - 0.5) * 14
        const reach = 70 + scatter(index, 2) * 40
        const radians = (angle * Math.PI) / 180
        const length = 0.34 + scatter(index, 3) * 0.14
        return step(
            { opacity: 0, x: 0, y: 0, rotate: angle, scaleX: 0.4 },
            {
                opacity: [0, 1, 1, 0],
                x: [Math.cos(radians) * 18, Math.cos(radians) * reach],
                y: [Math.sin(radians) * 18, Math.sin(radians) * reach],
                rotate: angle,
                scaleX: [0.4, 1.4, 0.3],
            },
            {
                ...forward(IMPACT, length),
                opacity: forward(IMPACT, length, 'linear', [0, 0.1, 0.6, 1]),
                scaleX: forward(IMPACT, length, EASE_OUT, [0, 0.3, 1]),
            },
        )
    })
    const confetti = Array.from({ length: CONFETTI_COUNT }, (_, index): Variants => {
        const angle = (index / CONFETTI_COUNT) * Math.PI * 2 + scatter(index, 4) * 0.4
        const reach = 55 + scatter(index, 5) * 55
        const x = Math.cos(angle) * reach
        const lift = Math.sin(angle) * reach - 20
        return step(
            { opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.4 },
            {
                opacity: [0, 1, 1, 0],
                x: [0, x, x * 1.1],
                y: [0, lift, lift + 45 + scatter(index, 6) * 30],
                rotate: (scatter(index, 7) - 0.5) * 720,
                scale: [0.4, 1, 0.9],
            },
            {
                ...forward(DECIDER_IMPACT, 0.44),
                opacity: forward(DECIDER_IMPACT, 0.44, 'linear', [0, 0.08, 0.7, 1]),
                x: forward(DECIDER_IMPACT, 0.44, EASE_OUT, [0, 0.35, 1]),
                y: forward(DECIDER_IMPACT, 0.44, 'linear', [0, 0.35, 1]),
                scale: forward(DECIDER_IMPACT, 0.44, EASE_OUT, [0, 0.2, 1]),
            },
        )
    })

    return {
        shakeOnImpact: shake(IMPACT),
        shakeOnStamp: shake(STAMP_HIT, 1.2),
        shakeOnDecider: shake(DECIDER_IMPACT, 0.7),
        pickFrame: slam(-7),
        banFrame: slam(6),
        goldFrame: step(
            { opacity: 0, scale: 0.72, y: 36 },
            { opacity: 1, scale: [0.72, 1.06, 1], y: [36, -6, 0] },
            { ...forward(0.24, DECIDER_IMPACT - 0.24 + 0.14, EASE_OUT, [0, 0.66, 1]), opacity: forward(0.24, 0.16) },
            reverse(0.05, 0.2),
        ),
        aura: step({ opacity: 0, scale: 0.3 }, { opacity: [0, 1, 0.55], scale: [0.3, 1.25, 1] }, forward(IMPACT - 0.04, 0.5, EASE_OUT, [0, 0.3, 1])),
        rays: step({ opacity: 0, scale: 0.4, rotate: -45 }, { opacity: [0, 1, 0.55], scale: [0.4, 1.08, 1], rotate: 0 }, forward(0, DECIDER_IMPACT + 0.2)),
        glow: step({ opacity: 0 }, { opacity: [0, 0.9, 0.4] }, forward(0.05, DECIDER_IMPACT + 0.25, EASE_OUT, [0, 0.7, 1])),
        raysTurn: { rotate: 360, transition: { duration: RAYS_TURN_S, ease: 'linear', repeat: Infinity } } satisfies TargetAndTransition,
        shockwave: shockwave(IMPACT),
        deciderShockwave: shockwave(DECIDER_IMPACT),
        teamFlash: flash(IMPACT, 0.8),
        goldFlash: flash(DECIDER_IMPACT, 0.85),
        sparks,
        confetti,
        slash: step({ opacity: 0, scaleX: 0 }, { opacity: [0, 1, 0.75], scaleX: [0, 1, 1] }, forward(IMPACT + 0.05, 0.2, EASE_OUT, [0, 0.6, 1])),
        crack: step({ opacity: 0, pathLength: 0 }, { opacity: 0.7, pathLength: 1 }, forward(IMPACT + 0.1, 0.22)),
        desaturate: step({ filter: 'grayscale(0) brightness(1)' }, { filter: 'grayscale(1) brightness(0.45)' }, forward(IMPACT + 0.05, 0.3), reverse(0, 0.25)),
        stamp: step({ opacity: 0, scale: 2.6, rotate: -14 }, { opacity: 1, scale: 1, rotate: 0 }, forward(STAMP_HIT - 0.14, 0.14, SLAM), reverse(0, 0.2)),
        badge: step({ opacity: 0, scale: 0.4, y: -8 }, { opacity: 1, scale: [0.4, 1.2, 1], y: 0 }, forward(IMPACT + 0.18, 0.26)),
        deciderBadge: step({ opacity: 0, scale: 0.4, y: -8 }, { opacity: 1, scale: [0.4, 1.2, 1], y: 0 }, forward(DECIDER_IMPACT + 0.24, 0.2)),
        sheen: step({ opacity: 0 }, { opacity: 1 }, forward(DECIDER_IMPACT, 0.4)),
        deciderRibbon: step({ opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1 }, forward(DECIDER_IMPACT + 0.04, 0.16)),
        letter: (index: number, count: number) => step(
            { opacity: 0, x: `${(index - (count - 1) / 2) * LETTER_SPREAD_EM}em`, scale: 1.5 },
            { opacity: 1, x: '0em', scale: 1 },
            forward(DECIDER_IMPACT + 0.08 + index * 0.025, 0.24),
        ),
        caption: step({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, forward(0.5, 0.35)),
        deciderCaption: step({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, forward(DECIDER_IMPACT + 0.2, 0.28)),
        fromLeft: step({ opacity: 0, x: '-45%' }, { opacity: 1, x: '0%' }, forward(0, 0.42), reverse(0, 0.3)),
        fromRight: step({ opacity: 0, x: '45%' }, { opacity: 1, x: '0%' }, forward(0.12, 0.42), reverse(0, 0.3)),
        streakLeft: step({ opacity: 0, scaleX: 0 }, { opacity: [0, 1, 0.35], scaleX: [0, 1, 1] }, forward(0, 0.6, EASE_OUT, [0, 0.55, 1])),
        streakRight: step({ opacity: 0, scaleX: 0 }, { opacity: [0, 1, 0.35], scaleX: [0, 1, 1] }, forward(0.12, 0.6, EASE_OUT, [0, 0.55, 1])),
        vs: step({ opacity: 0, scale: 3.2 }, { opacity: 1, scale: 1 }, forward(VS_HIT - 0.16, 0.16, SLAM), reverse(0, 0.2)),
        vsShockwave: step({ opacity: 0, scale: 0.6 }, { opacity: [0, 0.9, 0], scale: [0.6, 0.7, 3] }, forward(VS_HIT, 0.36, EASE_OUT, [0, 0.06, 1])),
        shakeOnVs: shake(VS_HIT, 0.8),
        countdown: step({ opacity: 0, y: 10 }, { opacity: 1, y: 0 }, forward(VS_HIT + 0.08, 0.3)),
    }
}

export type Choreography = ReturnType<typeof choreography>

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
