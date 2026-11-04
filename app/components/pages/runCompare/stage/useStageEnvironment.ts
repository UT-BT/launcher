import { useMemo } from 'react'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import type { StageEnvironment } from '../model/phoneStage'

function layoutWidth(): number {
    return window.innerWidth
}

function layoutHeight(): number {
    return window.innerHeight
}

export function useStageEnvironment(): StageEnvironment {
    const touch = useDeviceEnvironment(environment => environment.touch)
    const width = useDeviceEnvironment(layoutWidth)
    const height = useDeviceEnvironment(layoutHeight)
    return useMemo(() => ({ touch, width, height }), [touch, width, height])
}
