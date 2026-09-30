import { useRef, useState } from 'react'

export function errorText(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}

export function useChannelWriter(refresh: () => Promise<void>) {
    const writing = useRef(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const run = async (write: () => Promise<unknown>): Promise<boolean> => {
        if (writing.current) return false
        writing.current = true
        setPending(true)
        setError(null)
        let ok = false
        try {
            await write()
            ok = true
        } catch (caught) {
            setError(errorText(caught))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
        }
        return ok
    }

    return { pending, error, setError, run }
}
