import type { Variants } from 'framer-motion'

export function fadeInUp(y: number = 20, duration: number = 0.5): Variants {
  return {
    hidden: { opacity: 0, y },
    visible: (delay: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration, delay, ease: 'easeOut' }
    })
  }
}

export function scaleIn(fromScale: number = 0.95, duration: number = 0.6): Variants {
  return {
    hidden: { opacity: 0, scale: fromScale },
    visible: (delay: number = 0) => ({
      opacity: 1,
      scale: 1,
      transition: { duration, delay, ease: 'easeOut' }
    })
  }
}

export function scaleFadeIn(fromScale: number = 0.8, duration: number = 0.5): Variants {
  return {
    hidden: { opacity: 0, scale: fromScale },
    visible: (delay: number = 0) => ({
      opacity: 1,
      scale: 1,
      transition: { duration, delay, ease: 'easeOut' }
    })
  }
}


