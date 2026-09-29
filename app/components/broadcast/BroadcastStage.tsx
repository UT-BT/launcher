import { useLayoutEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STAGE_HEIGHT, STAGE_WIDTH, computeStageScale } from './stageScale'

export function BroadcastStage({ transparent = false, children }: { transparent?: boolean; children: ReactNode }) {
    const [scale, setScale] = useState(() => computeStageScale(window.innerWidth, window.innerHeight))

    useLayoutEffect(() => {
        const update = () => setScale(computeStageScale(window.innerWidth, window.innerHeight))
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    return (
        <div className={cn('fixed inset-0 flex items-center justify-center overflow-hidden', !transparent && 'bg-black')}>
            <div
                style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
                className={cn('relative shrink-0 origin-center', !transparent && 'bg-background')}
            >
                {children}
            </div>
        </div>
    )
}
