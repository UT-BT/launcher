import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { displayMapName } from '@/app/utils/format'
import type { MapDownloadState } from '@/app/hooks/useMapDownload'

interface MapDownloadStatusModalProps {
    state: MapDownloadState | null
    onClose: () => void
}

function reasonText(reason: string): string {
    if (reason === 'no-install') return 'A valid UT99 installation is required to install maps. Set one up in Settings → Game Installation.'
    if (reason === 'timeout') return 'Download took longer than 30 seconds. The server may still be packaging the map — try again in a moment.'
    if (reason === 'empty-zip') return 'The downloaded archive was empty. Try again, or the map may not be available.'
    if (reason === 'extract-error') return 'Failed to extract the map archive. The download may be corrupt.'
    if (reason === 'write-error') return 'Failed to write map files to disk. Check that the launcher has write access to the install folder.'
    if (reason.startsWith('http-')) return `The map server responded with ${reason.replace('http-', 'status ')}. The map may not exist on the service.`
    if (reason === 'fetch-error') return 'Network error while downloading. Check your connection and try again.'
    return `Map install failed (${reason}).`
}

export function MapDownloadStatusModal({ state, onClose }: MapDownloadStatusModalProps) {
    const isOpen = state !== null
    const isDownloading = state?.status === 'downloading'
    const title =
        state?.status === 'success' ? 'Map Installed'
        : state?.status === 'error' ? 'Install Failed'
        : 'Downloading Map'

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { if (!isDownloading) onClose() }}
            title={title}
            offsetSidebar
            maxWidth="500px"
            className="bg-[#0a0a0b]/98 border-white/5"
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end shrink-0">
                    <Button onClick={onClose} disabled={isDownloading} variant="secondary">
                        {isDownloading ? 'Downloading…' : 'Close'}
                    </Button>
                </div>
            }
        >
            {state?.status === 'downloading' && (
                <div className="space-y-2 py-2">
                    <div className="flex items-center gap-3">
                        <Loader2 className="size-5 animate-spin text-blue-300 shrink-0" />
                        <div className="text-sm text-white/80 truncate">{displayMapName(state.mapName)}</div>
                    </div>
                    <p className="text-xs text-muted-foreground pl-8">
                        The map download server may need to package this map. This can take up to 30 seconds, please be patient.
                    </p>
                </div>
            )}
            {state?.status === 'success' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                        <div className="text-sm text-white/90 font-medium truncate">{displayMapName(state.mapName)}</div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                        <div>Extracted: {state.extracted.length} file{state.extracted.length === 1 ? '' : 's'}</div>
                        {state.skipped.length > 0 && (
                            <div>Skipped (already existed): {state.skipped.length} file{state.skipped.length === 1 ? '' : 's'}</div>
                        )}
                        <div className="truncate" title={state.installPath}>
                            Installed to: {state.installPath}
                        </div>
                    </div>
                </div>
            )}
            {state?.status === 'error' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="size-5 text-red-400 shrink-0" />
                        <div className="text-sm text-white/90 font-medium">Could not install map</div>
                    </div>
                    <p className="text-xs text-muted-foreground">{reasonText(state.reason)}</p>
                </div>
            )}
        </Modal>
    )
}
