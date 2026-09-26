import { useEffect, useRef, useState } from 'react'

const COPIED_MS = 1500

export function useCopyFeedback(onError: (error: unknown) => void) {
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const timer = useRef<number | null>(null)

    useEffect(() => () => {
        if (timer.current !== null) window.clearTimeout(timer.current)
    }, [])

    const copy = async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text)
        } catch (error) {
            onError(error)
            return
        }
        setCopiedKey(key)
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopiedKey(null), COPIED_MS)
    }

    return { copiedKey, copy }
}
