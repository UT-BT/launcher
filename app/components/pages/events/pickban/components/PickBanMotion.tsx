import { createContext, useContext, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

const PickBanAnimateContext = createContext(true)

export function usePickBanAnimate(): boolean {
    return useContext(PickBanAnimateContext)
}

export function PickBanMotion({ animate, children }: { animate: boolean; children: ReactNode }) {
    return (
        <PickBanAnimateContext.Provider value={animate}>
            <MotionConfig reducedMotion="never" skipAnimations={!animate}>
                <div data-motion={animate ? 'on' : 'off'} className="contents">
                    {children}
                </div>
            </MotionConfig>
        </PickBanAnimateContext.Provider>
    )
}
