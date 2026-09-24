import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'

export function PickBanMotion({ children }: { children: ReactNode }) {
    const reducedMotion = usePrefersReducedMotion()
    return (
        <MotionConfig reducedMotion="user" skipAnimations={reducedMotion}>
            {children}
        </MotionConfig>
    )
}
