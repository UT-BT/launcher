import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useUpdater } from '@/app/hooks/useUpdater'

export function UpdateBanner() {
    const { state, isModalOpen, openModal, install } = useUpdater()
    const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

    if (isModalOpen || state.phase !== 'downloaded') return null
    if (state.version && dismissedVersion === state.version) return null

    return (
        <div className="relative z-[60] w-full bg-accent-500/15 border-b border-accent-500/40 px-6 py-1.5">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-accent-200">
                <p className="font-semibold leading-tight">
                    UTBT v{state.version} is ready and installs the next time UTBT starts.
                </p>
                <Button size="sm" className="h-7" onClick={() => { void install() }}>
                    <RefreshCw className="size-3.5" />
                    Restart now
                </Button>
                <Button variant="link" size="sm" className="h-7 px-1 text-accent-200" onClick={openModal}>
                    What's new
                </Button>
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setDismissedVersion(state.version ?? null)}
                    className="rounded p-1 text-accent-200/70 hover:text-accent-200 hover:bg-white/10 transition-colors"
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    )
}
