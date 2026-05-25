import { useEffect, useRef, useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatCapTime, displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'

export interface ReplayVideoState {
    url: string
    mapName: string
    time?: number
    alias?: string
}

interface ReplayVideoModalProps {
    state: ReplayVideoState | null
    onClose: () => void
    leftAction?: React.ReactNode
}

function buildTitle(s: ReplayVideoState | null): string {
    if (!s) return ''
    const cleanMap = displayMapName(s.mapName)
    if (s.time != null && s.alias) {
        return `Replay — ${formatCapTime(s.time)} by ${s.alias} on ${cleanMap}`
    }
    return `Replay — ${cleanMap}`
}

export function ReplayVideoModal({ state, onClose, leftAction }: ReplayVideoModalProps) {
    const [shareCopied, setShareCopied] = useState(false)
    const shareTimerRef = useRef<number | null>(null)

    useEffect(() => () => {
        if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current)
    }, [])

    const copyLink = async () => {
        if (!state?.url) return
        try {
            await navigator.clipboard.writeText(state.url)
            setShareCopied(true)
            if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current)
            shareTimerRef.current = window.setTimeout(() => setShareCopied(false), 1500)
        } catch (err) {
            console.error('Copy replay link failed', err)
        }
    }

    return (
        <Modal
            isOpen={state !== null}
            onClose={onClose}
            title={buildTitle(state)}
            offsetSidebar
            className="bg-[#0a0a0b]/98 border-white/5"
            maxWidth="min(90vw, 1280px)"
            leftAction={leftAction}
            footer={
                <div className="p-3 border-t border-border bg-muted/50 flex items-center justify-between gap-3 shrink-0">
                    <Tooltip content={shareCopied ? 'Link copied!' : 'Copy replay link'} side="top">
                        <button
                            type="button"
                            onClick={copyLink}
                            aria-label="Copy replay link"
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                shareCopied
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/[0.03] border-white/10 text-muted-foreground hover:text-white hover:bg-white/[0.06] hover:border-white/20',
                            )}
                        >
                            {shareCopied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
                            {shareCopied ? 'Copied' : 'Share'}
                        </button>
                    </Tooltip>
                    <div className="text-xs text-muted-foreground flex items-center">
                        Powered by{' '}
                        <a
                            href="https://democonverter.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-blue-400 hover:underline"
                        >
                            democonverter.com
                        </a>
                    </div>
                </div>
            }
        >
            {state && (
                <video
                    key={state.url}
                    src={state.url}
                    controls
                    autoPlay
                    className="w-full aspect-video bg-black rounded"
                />
            )}
        </Modal>
    )
}
