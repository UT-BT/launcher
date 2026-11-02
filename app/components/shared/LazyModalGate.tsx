import { Suspense, useState, type ReactNode } from 'react'
import { Spinner } from '@/app/components/ui/spinner'

function ModalLoading() {
    return (
        <div
            role="status"
            aria-label="Loading"
            className="fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
            <Spinner className="size-6 text-muted-foreground" />
        </div>
    )
}

export function LazyModalGate({ open, children }: { open: boolean; children: ReactNode }) {
    const [opened, setOpened] = useState(open)
    if (open && !opened) setOpened(true)
    if (!opened) return null
    return <Suspense fallback={<ModalLoading />}>{children}</Suspense>
}
