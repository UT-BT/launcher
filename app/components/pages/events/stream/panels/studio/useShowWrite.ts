import { useRef, useState } from 'react'
import { useStreamTab } from '../../StreamTabContext'

export function showErrorText(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}

export function useShowWrite() {
    const { refresh } = useStreamTab()
    const writing = useRef(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const run = async (write: () => Promise<unknown>): Promise<boolean> => {
        if (writing.current) return false
        writing.current = true
        setPending(true)
        setError(null)
        let saved = false
        try {
            await write()
            saved = true
        } catch (caught) {
            setError(showErrorText(caught))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
        }
        return saved
    }

    return { run, pending, error }
}
