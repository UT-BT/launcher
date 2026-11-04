import { useLayoutEffect, useState } from 'react'
import type { StageBox } from '../model/stageLayout'

export const MIN_THEATER_HEIGHT = 320

function paddingBottom(element: Element): number {
    return Number.parseFloat(getComputedStyle(element).paddingBottom) || 0
}

export function useTheaterHeight(theater: HTMLElement | null): number | null {
    const [height, setHeight] = useState<number | null>(null)

    useLayoutEffect(() => {
        const scroller = theater?.closest('main')
        if (!theater || !scroller) return
        const measure = () => {
            const top = theater.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
            let below = paddingBottom(scroller)
            for (let node = theater.parentElement; node && node !== scroller; node = node.parentElement) below += paddingBottom(node)
            setHeight(Math.max(MIN_THEATER_HEIGHT, Math.floor(scroller.clientHeight - top - below)))
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(scroller)
        if (theater.parentElement) observer.observe(theater.parentElement)
        return () => observer.disconnect()
    }, [theater])

    return height
}

export function useStageBox(stage: HTMLElement | null): StageBox | null {
    const [box, setBox] = useState<StageBox | null>(null)

    useLayoutEffect(() => {
        if (!stage) return
        const measure = () => {
            const width = Math.floor(stage.clientWidth)
            const height = Math.floor(stage.clientHeight)
            setBox(previous => (previous?.width === width && previous.height === height ? previous : { width, height }))
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(stage)
        return () => observer.disconnect()
    }, [stage])

    return box
}

export function useElementHeight(element: HTMLElement | null): number | null {
    const [height, setHeight] = useState<number | null>(null)

    useLayoutEffect(() => {
        if (!element) return
        const measure = () => setHeight(Math.ceil(element.getBoundingClientRect().height))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [element])

    return height
}
