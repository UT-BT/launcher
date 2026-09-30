import { useEffect, useId, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Info } from 'lucide-react'
import { usePlatform } from '@/app/platform'
import { useAsync } from '@/app/hooks/useAsync'
import { cn } from '@/lib/utils'
import { StreamCard, StreamLoading } from '../StreamCard'
import { useStreamTab } from '../StreamTabContext'
import { kitBannerState, type KitBannerState } from './kit/kitBanner'
import { kitExtractFailureMessage } from './kit/kitExtractMessages'
import { fetchKitInfo, fetchKitZip, kitDownloadUrl, kitZipName, saveBlobAsFile } from './kit/kitFetch'
import { browserStore, kitFolderError, loadKitFolder, normalizeKitFolder, saveKitFolder } from './kit/kitFolder'

type DownloadState =
    | { status: 'idle' }
    | { status: 'working'; phase: 'downloading' | 'extracting'; done: number; total: number | null }
    | { status: 'saved'; fileName: string }
    | { status: 'extracted'; folder: string; files: number }
    | { status: 'failed'; message: string }

const REIMPORT_STEPS = 'In OBS, choose Scene Collection > Import for UTBT-StreamKit-Scenes.json, and Profile > Import for the UTBT-StreamKit-Profile folder.'

export function KitSection() {
    const { eventSlug, streamerId, accessToken } = useStreamTab()
    const { capabilities } = usePlatform()
    const folderInputId = useId()
    const folderErrorId = useId()
    const [folder, setFolder] = useState(() => loadKitFolder(browserStore(), streamerId))
    const [download, setDownload] = useState<DownloadState>({ status: 'idle' })
    const info = useAsync(
        signal => fetchKitInfo(accessToken, eventSlug, streamerId, signal),
        [accessToken, eventSlug, streamerId],
        { errorMessage: 'Could not check your kit version.' },
    )

    const folderError = kitFolderError(folder)
    const working = download.status === 'working'
    const banner: KitBannerState | null = info.data ? kitBannerState(info.data) : null
    const desktop = capabilities.camTool

    useEffect(() => {
        if (!desktop) return
        return window.utStreamKit.onKitProgress(progress => {
            setDownload(current => (current.status === 'working' ? { status: 'working', ...progress } : current))
        })
    }, [desktop])

    function changeFolder(value: string) {
        setFolder(value)
        if (kitFolderError(value) === null) saveKitFolder(browserStore(), streamerId, value)
    }

    async function startDownload() {
        if (folderError || working) return
        const target = normalizeKitFolder(folder)
        setDownload({ status: 'working', phase: 'downloading', done: 0, total: null })
        try {
            if (desktop) {
                const result = await window.conveyor.streamKit.extractKit({
                    url: kitDownloadUrl(eventSlug, streamerId, target),
                    token: accessToken,
                    folder: target,
                })
                if (!result.ok) {
                    setDownload({ status: 'failed', message: kitExtractFailureMessage(result.reason) })
                    return
                }
                setDownload({ status: 'extracted', folder: result.folder, files: result.files.length })
            } else {
                const blob = await fetchKitZip(accessToken, eventSlug, streamerId, target)
                const fileName = kitZipName(eventSlug)
                saveBlobAsFile(fileName, blob)
                setDownload({ status: 'saved', fileName })
            }
            info.reload()
        } catch (err) {
            setDownload({ status: 'failed', message: err instanceof Error ? err.message : 'The kit download failed.' })
        }
    }

    return (
        <div className="space-y-4">
            {banner && banner !== 'current' && <KitBanner state={banner} />}
            <StreamCard title="Kit" description="Your personalised OBS kit: scenes, profile and stinger.">
                <div className="max-w-xl space-y-1.5">
                    <label htmlFor={folderInputId} className="text-xs font-medium text-foreground">Kit folder</label>
                    <input
                        id={folderInputId}
                        type="text"
                        value={folder}
                        onChange={event => changeFolder(event.target.value)}
                        disabled={working}
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={folderError !== null}
                        aria-describedby={folderError ? folderErrorId : undefined}
                        className={cn(
                            'h-9 w-full rounded-md border bg-card/40 px-3 font-mono text-xs text-foreground outline-none transition-colors focus-visible:border-accent-500/60 disabled:opacity-60',
                            folderError ? 'border-destructive/60' : 'border-hairline/10',
                        )}
                    />
                    {folderError ? (
                        <p id={folderErrorId} role="alert" className="text-xs text-destructive">{folderError}</p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Where you keep the kit on your PC. The stinger path inside the scene collection points here.
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void startDownload()}
                        disabled={folderError !== null || working}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download className="size-3.5" />
                        {desktop ? 'Download and extract kit' : 'Download kit'}
                    </button>
                    {info.loading && !info.data && <StreamLoading label="your kit version" />}
                    {info.error && <p role="alert" className="text-xs text-destructive">{info.error}</p>}
                </div>

                <DownloadStatus state={download} />

                <p className="flex max-w-3xl items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        Visual changes to the scenes reach OBS automatically, so you don&apos;t need to re-import for those.
                        Re-import only when this tab tells you the kit structure changed. The kit never contains a stream key, and this tab never asks for one.
                    </span>
                </p>
            </StreamCard>
        </div>
    )
}

function KitBanner({ state }: { state: Exclude<KitBannerState, 'current'> }) {
    const headline = state === 'never-downloaded'
        ? "You haven't downloaded your kit yet."
        : 'Your OBS kit is out of date. Download it again and re-import it.'

    return (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="space-y-1">
                <p className="font-semibold">{headline}</p>
                <p className="text-muted-foreground">
                    {state === 'outdated' && 'The scene layout in OBS changed. '}
                    {REIMPORT_STEPS}
                </p>
            </div>
        </div>
    )
}

function DownloadStatus({ state }: { state: DownloadState }) {
    if (state.status === 'idle') return null

    if (state.status === 'working') {
        const counted = state.total !== null && state.total > 0
        const percent = counted ? Math.min(100, Math.round((state.done / (state.total as number)) * 100)) : null
        const label = state.phase === 'downloading' ? 'Downloading the kit' : 'Extracting the kit'
        return (
            <div role="status" className="max-w-xl space-y-1.5">
                <p className="text-xs text-foreground">{label}{percent !== null ? `… ${percent}%` : '…'}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-card/60">
                    <div
                        className={cn('h-full rounded-full bg-accent-500 transition-[width]', percent === null && 'w-1/3 animate-pulse')}
                        style={percent === null ? undefined : { width: `${percent}%` }}
                    />
                </div>
            </div>
        )
    }

    if (state.status === 'failed') {
        return <p role="alert" className="text-xs text-destructive">{state.message}</p>
    }

    return (
        <p role="status" className="flex items-start gap-2 text-xs text-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
            {state.status === 'extracted' ? (
                <span>Kit extracted to <span className="break-all font-mono">{state.folder}</span> ({state.files} files). {REIMPORT_STEPS}</span>
            ) : (
                <span>Saved {state.fileName}. Unzip it into your kit folder. {REIMPORT_STEPS}</span>
            )}
        </p>
    )
}
