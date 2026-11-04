import { useEffect, useState } from 'react'

export function useAfterPaint(ready: boolean): boolean {
    const [painted, setPainted] = useState(false)
    useEffect(() => {
        if (!ready || painted) return
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => setPainted(true))
        })
        return () => cancelAnimationFrame(frame)
    }, [ready, painted])
    return painted
}
