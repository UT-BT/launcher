import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import type { DemoDownloadState } from '@/app/hooks/useDemoDownload'

interface DemoDownloadStatusModalProps {
    state: DemoDownloadState | null
    onClose: () => void
}

function reasonText(reason: string): string {
    if (reason === 'no-install') return 'A valid UT99 installation is required to download demos. Set one up in Settings → Game Installation.'
    if (reason === 'empty') return 'The downloaded demo was empty. Try again, or pick a different run.'
    if (reason.startsWith('http-')) return `The demo server responded with ${reason.replace('http-', 'status ')}. The demo may not be available.`
    if (reason === 'fetch-error') return 'Network error while downloading. Check your connection and try again.'
    return `Download failed (${reason}).`
}

function formatBytes(b: number): string {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

export function DemoDownloadStatusModal({ state, onClose }: DemoDownloadStatusModalProps) {
    const isOpen = state !== null
    const isDownloading = state?.status === 'downloading'
    const title =
        state?.status === 'success' ? 'Demo Downloaded'
        : state?.status === 'error' ? 'Download Failed'
        : 'Downloading Demo'

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
                <div className="flex items-center gap-3 py-2">
                    <Loader2 className="size-5 animate-spin text-accent-300 shrink-0" />
                    <div className="text-sm text-white/80 truncate">{state.filename}</div>
                </div>
            )}
            {state?.status === 'success' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
                        <div className="text-sm text-white/90 font-medium truncate">{state.filename}</div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                        <div>Size: {formatBytes(state.bytes)}</div>
                        <div className="truncate" title={state.path}>
                            Saved to: {state.path.replace(/[/\\][^/\\]+$/, '')}
                        </div>
                    </div>
                </div>
            )}
            {state?.status === 'error' && (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="size-5 text-red-400 shrink-0" />
                        <div className="text-sm text-white/90 font-medium">Could not download demo</div>
                    </div>
                    <p className="text-xs text-muted-foreground">{reasonText(state.reason)}</p>
                </div>
            )}
        </Modal>
    )
}
