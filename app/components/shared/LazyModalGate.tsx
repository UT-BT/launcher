import { Suspense, useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Spinner } from '@/app/components/ui/spinner'
import { lockShellScroll } from '@/app/components/ui/scrollLock'

function ModalLoading() {
    useLayoutEffect(() => lockShellScroll(), [])
    return createPortal(
        <div
            role="status"
            aria-label="Loading"
            className="fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm touch:backdrop-filter-none p-4"
        >
            <Spinner className="size-6 text-muted-foreground" />
        </div>,
        document.body
    )
}

export function LazyModalGate({ open, children }: { open: boolean; children: ReactNode }) {
    const [opened, setOpened] = useState(open)
    if (open && !opened) setOpened(true)
    if (!opened) return null
    return <Suspense fallback={<ModalLoading />}>{children}</Suspense>
}
