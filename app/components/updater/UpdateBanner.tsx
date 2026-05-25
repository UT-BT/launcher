import { useUpdater } from '@/app/hooks/useUpdater'

export function UpdateBanner() {
    const { state, isModalOpen, openModal } = useUpdater()

    const shouldShow =
        !isModalOpen && (state.phase === 'available' || state.phase === 'downloaded')

    if (!shouldShow) return null

    const isDownloaded = state.phase === 'downloaded'
    const headline = isDownloaded ? 'Update downloaded and ready to install!' : 'Launcher update available!'

    return (
        <div
            onClick={openModal}
            className="relative z-[60] w-full bg-blue-500/15 border-b border-blue-500/40 px-6 py-2.5 cursor-pointer hover:bg-blue-500/25 hover:border-blue-500/60 transition-colors group"
        >
            <div className="flex items-center gap-3 text-blue-200">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight text-center">
                        {headline}
                    </p>
                </div>
            </div>
        </div>
    )
}
