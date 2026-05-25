import ReactMarkdown from 'react-markdown'
import { Download, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { useUpdater } from '@/app/hooks/useUpdater'
import { cn } from '@/lib/utils'

const RELEASE_NOTES_HTML_CLASSES = [
    'text-muted-foreground max-h-96 overflow-y-auto custom-scrollbar pr-2',
    '[&_p]:mb-3 [&_p]:last:mb-0 [&_p]:leading-relaxed',
    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1',
    '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1',
    '[&_li]:leading-relaxed',
    '[&_strong]:font-bold [&_strong]:text-foreground',
    '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:mb-2 [&_h1]:mt-3',
    '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-2 [&_h2]:mt-3',
    '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-2 [&_h3]:mt-3',
    '[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline',
    '[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-foreground [&_code]:text-xs',
    '[&_hr]:my-4 [&_hr]:border-border',
].join(' ')

function looksLikeHtml(text: string): boolean {
    return /<\s*(p|ul|ol|li|h[1-6]|a|strong|em|code|pre|br|hr|div|span)\b/i.test(text)
}

function sanitizeHtml(html: string): string {
    return html
        .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
        .replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
        .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/<a\b([^>]*)>/gi, (_match, attrs: string) => {
            const cleaned = attrs
                .replace(/\starget\s*=\s*("[^"]*"|'[^']*')/gi, '')
                .replace(/\srel\s*=\s*("[^"]*"|'[^']*')/gi, '')
            return `<a${cleaned} target="_blank" rel="noreferrer noopener">`
        })
}

function ReleaseNotes({ notes }: { notes: string }) {
    if (looksLikeHtml(notes)) {
        return (
            <div
                className={RELEASE_NOTES_HTML_CLASSES}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(notes) }}
            />
        )
    }
    return (
        <div className="text-muted-foreground max-h-96 overflow-y-auto custom-scrollbar pr-2">
            <ReactMarkdown
                components={{
                    strong: ({ node: _node, ...props }) => <span className="font-bold text-foreground" {...props} />,
                    p: ({ node: _node, ...props }) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
                    ul: ({ node: _node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                    ol: ({ node: _node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                    li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
                    h1: ({ node: _node, ...props }) => <h3 className="text-base font-semibold text-foreground mb-2 mt-3" {...props} />,
                    h2: ({ node: _node, ...props }) => <h4 className="text-sm font-semibold text-foreground mb-2 mt-3" {...props} />,
                    h3: ({ node: _node, ...props }) => <h5 className="text-sm font-semibold text-foreground mb-2 mt-3" {...props} />,
                    a: ({ node: _node, ...props }) => <a className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer" {...props} />,
                    code: ({ node: _node, ...props }) => <code className="px-1 py-0.5 rounded bg-muted text-foreground text-xs" {...props} />,
                }}
            >
                {notes}
            </ReactMarkdown>
        </div>
    )
}

function formatBytes(bytes: number | undefined): string {
    if (!bytes || !Number.isFinite(bytes)) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
}

function formatSpeed(bytesPerSecond: number | undefined): string {
    if (!bytesPerSecond || !Number.isFinite(bytesPerSecond)) return ''
    const mbps = bytesPerSecond / (1024 * 1024)
    return `${mbps.toFixed(2)} MB/s`
}

export function UpdateModal() {
    const { state, isModalOpen, closeModal, download, install } = useUpdater()

    const isVisiblePhase =
        state.phase === 'available' ||
        state.phase === 'downloading' ||
        state.phase === 'downloaded' ||
        state.phase === 'installing' ||
        (state.phase === 'error' && state.lastCheckTrigger === 'manual') ||
        (state.phase === 'not-available' && state.lastCheckTrigger === 'manual') ||
        state.phase === 'checking'

    if (!isModalOpen || !isVisiblePhase) return null

    const title = (() => {
        switch (state.phase) {
            case 'available':
                return `Update available${state.version ? ` — v${state.version}` : ''}`
            case 'downloading':
                return 'Downloading update'
            case 'downloaded':
                return `Update ready${state.version ? ` — v${state.version}` : ''}`
            case 'installing':
                return 'Installing…'
            case 'checking':
                return 'Checking for updates'
            case 'not-available':
                return 'Up to date'
            case 'error':
                return 'Update error'
            default:
                return 'Launcher updates'
        }
    })()

    const percent = Math.max(0, Math.min(100, state.progressPercent ?? 0))

    const footer = (() => {
        if (state.phase === 'available') {
            return (
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={closeModal}>Later</Button>
                    <Button onClick={() => { void download() }}>
                        <Download className="size-4" />
                        Download now
                    </Button>
                </div>
            )
        }
        if (state.phase === 'downloading') {
            return (
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={closeModal}>Hide</Button>
                </div>
            )
        }
        if (state.phase === 'downloaded') {
            return (
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={closeModal}>Later</Button>
                    <Button onClick={() => { void install() }}>
                        <RefreshCw className="size-4" />
                        Restart & install
                    </Button>
                </div>
            )
        }
        if (state.phase === 'error' || state.phase === 'not-available' || state.phase === 'checking' || state.phase === 'installing') {
            return (
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={closeModal}>Close</Button>
                </div>
            )
        }
        return undefined
    })()

    return (
        <Modal
            isOpen
            onClose={closeModal}
            title={title}
            footer={footer}
            maxWidth="640px"
        >
            <div className="space-y-4 text-sm">
                <div className="text-xs text-muted-foreground">
                    Current version: v{state.currentVersion}
                </div>

                {state.phase === 'available' && (
                    <div>
                        {state.releaseNotes ? (
                            <ReleaseNotes notes={state.releaseNotes} />
                        ) : (
                            <p className="text-muted-foreground">
                                A new version is ready to download.
                            </p>
                        )}
                    </div>
                )}

                {state.phase === 'downloading' && (
                    <div className="space-y-3">
                        <p className="text-muted-foreground">
                            Downloading v{state.version}…
                        </p>
                        <ProgressBar percent={percent} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>
                                {formatBytes(state.transferred)} / {formatBytes(state.total)}
                            </span>
                            <span>
                                {percent.toFixed(0)}%
                                {state.bytesPerSecond ? ` · ${formatSpeed(state.bytesPerSecond)}` : ''}
                            </span>
                        </div>
                    </div>
                )}

                {state.phase === 'downloaded' && (
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">
                            Update downloaded. Restart the launcher to finish installing v{state.version}.
                        </p>
                    </div>
                )}

                {state.phase === 'checking' && (
                    <p className="text-muted-foreground">Checking GitHub for the latest release…</p>
                )}

                {state.phase === 'not-available' && (
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">
                            You're running the latest version (v{state.currentVersion}).
                        </p>
                    </div>
                )}

                {state.phase === 'installing' && (
                    <p className="text-muted-foreground">Launching installer — the launcher will close shortly.</p>
                )}

                {state.phase === 'error' && (
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-foreground font-medium">Update check failed</p>
                            <p className="text-muted-foreground text-xs break-words">
                                {state.error ?? 'Unknown error.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}

function ProgressBar({ percent }: { percent: number }) {
    return (
        <div className={cn('h-2 w-full rounded-full bg-muted overflow-hidden')}>
            <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${percent}%` }}
            />
        </div>
    )
}
