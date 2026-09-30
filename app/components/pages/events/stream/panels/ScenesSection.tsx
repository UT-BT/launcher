import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { IS_WEB } from '@/app/platform/target'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import { cn } from '@/lib/utils'
import { StreamCard } from '../StreamCard'
import { useStreamTab } from '../StreamTabContext'
import { sceneLinks, type SceneLink } from './sceneLinks'

const SCENE_WIDTH = 1920
const SCENE_HEIGHT = 1080

const CHECKERBOARD = {
    backgroundColor: '#3a3a3a',
    backgroundImage: 'repeating-conic-gradient(#555 0% 25%, transparent 0% 50%)',
    backgroundSize: '16px 16px',
}

export function ScenesSection() {
    const { eventSlug, streamerId } = useStreamTab()
    const links = useMemo(() => sceneLinks(eventSlug, streamerId, IS_WEB), [eventSlug, streamerId])
    const { copiedKey, copy } = useCopyFeedback(error => console.error('Copy scene URL failed', error))

    return (
        <StreamCard title="Scenes" description="Your scene URLs for OBS, with copy buttons and live previews.">
            <p className="text-xs text-muted-foreground">
                Visual changes reach OBS automatically, so you never need to re-import. Add a scene as a Browser source with its URL, or repair a single source by pasting it again.
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {links.map(link => (
                    <SceneTile key={link.id} link={link} copied={copiedKey === link.id} onCopy={() => copy(link.id, link.url)} />
                ))}
            </ul>
        </StreamCard>
    )
}

function SceneTile({ link, copied, onCopy }: { link: SceneLink; copied: boolean; onCopy: () => void }) {
    return (
        <li className="min-w-0 space-y-2 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <h3 className="text-sm font-medium text-foreground">{link.label}</h3>
            <ScenePreview link={link} />
            <div className="flex items-center gap-2">
                <input
                    readOnly
                    value={link.url}
                    aria-label={`${link.label} URL`}
                    onFocus={event => event.currentTarget.select()}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-hairline/10 bg-background/60 px-2 font-mono text-xs text-muted-foreground"
                />
                <button
                    type="button"
                    aria-label={`Copy ${link.label} URL`}
                    onClick={onCopy}
                    className={cn(
                        'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-xs transition-colors sm:h-9',
                        copied
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:text-foreground',
                    )}
                >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
        </li>
    )
}

function ScenePreview({ link }: { link: SceneLink }) {
    const frameRef = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)
    const [scale, setScale] = useState(0)

    useEffect(() => {
        const frame = frameRef.current
        if (!frame) return
        const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
        const resize = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / SCENE_WIDTH))
        intersection.observe(frame)
        resize.observe(frame)
        return () => {
            intersection.disconnect()
            resize.disconnect()
        }
    }, [])

    return (
        <div
            ref={frameRef}
            data-testid={`scene-preview-${link.id}`}
            style={link.transparent ? CHECKERBOARD : undefined}
            className="relative aspect-video w-full overflow-hidden rounded-md border border-hairline/10 bg-black"
        >
            {visible && scale > 0 && (
                <iframe
                    title={`${link.label} preview`}
                    src={link.previewSrc}
                    loading="lazy"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{
                        width: SCENE_WIDTH,
                        height: SCENE_HEIGHT,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        colorScheme: 'dark',
                    }}
                    className="pointer-events-none absolute left-0 top-0 border-0"
                />
            )}
        </div>
    )
}
