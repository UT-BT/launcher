import { useCallback, useEffect, useState } from 'react'

export interface StageFullscreen {
    supported: boolean
    active: boolean
    toggle: () => void
}

function fullscreenSupported(): boolean {
    return document.fullscreenEnabled === true && typeof HTMLElement.prototype.requestFullscreen === 'function'
}

export function useStageFullscreen(element: HTMLElement | null): StageFullscreen {
    const [supported] = useState(fullscreenSupported)
    const [active, setActive] = useState(false)

    useEffect(() => {
        if (!element) return
        const sync = () => setActive(document.fullscreenElement === element)
        sync()
        document.addEventListener('fullscreenchange', sync)
        return () => {
            document.removeEventListener('fullscreenchange', sync)
            if (document.fullscreenElement === element) document.exitFullscreen().catch(() => {})
        }
    }, [element])

    const toggle = useCallback(() => {
        if (!element || !supported) return
        if (document.fullscreenElement === element) document.exitFullscreen().catch(() => {})
        else element.requestFullscreen().catch(() => {})
    }, [element, supported])

    return { supported, active, toggle }
}
