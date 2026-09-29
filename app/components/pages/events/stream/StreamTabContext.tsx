import { createContext, useContext, type ReactNode } from 'react'

export interface StreamTabContextValue {
    eventSlug: string
    streamerId: string
    isManager: boolean
    accessToken: string
}

const StreamTabContext = createContext<StreamTabContextValue | null>(null)

export function StreamTabProvider({ value, children }: { value: StreamTabContextValue; children: ReactNode }) {
    return <StreamTabContext.Provider value={value}>{children}</StreamTabContext.Provider>
}

export function useStreamTab(): StreamTabContextValue {
    const value = useContext(StreamTabContext)
    if (!value) throw new Error('useStreamTab must be used inside the Stream tab')
    return value
}
