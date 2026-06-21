import { useLayoutEffect, useState } from 'react'

export function useElementWidth(
    ref: React.RefObject<HTMLElement | null>,
    delay = 150,
): number {
    const [width, setWidth] = useState(0)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return

        setWidth(prev => {
            const next = el.getBoundingClientRect().width
            return prev === next ? prev : next
        })

        let timer: ReturnType<typeof setTimeout> | null = null
        const observer = new ResizeObserver(entries => {
            const entry = entries[0]
            if (!entry) return
            const next = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                setWidth(prev => (prev === next ? prev : next))
            }, delay)
        })
        observer.observe(el)

        return () => {
            if (timer) clearTimeout(timer)
            observer.disconnect()
        }
    }, [ref, delay])

    return width
}
