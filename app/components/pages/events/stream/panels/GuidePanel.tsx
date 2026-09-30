import { useEffect, useRef } from 'react'
import { ChevronDown, Download, Link2 } from 'lucide-react'
import { usePlatform } from '@/app/platform'
import { useNavState } from '@/app/components/navigation/useNavState'
import { cn } from '@/lib/utils'
import { StreamCard } from '../StreamCard'
import { guideStepFromHash, guideStepHash, toggleStep, withStepOpen } from './guide/guideDeepLink'
import { DESKTOP_LAUNCHER_URL, GUIDE_STEPS, guideStepIds, type GuideBlock, type GuideStep } from './guide/guideSteps'

export function GuidePanel() {
    const { capabilities } = usePlatform()
    const desktop = capabilities.camTool
    const [openSteps, setOpenSteps] = useNavState<string[]>('event.guideOpen', [GUIDE_STEPS[0].id])
    const openRef = useRef(openSteps)
    openRef.current = openSteps

    useEffect(() => {
        const linked = guideStepFromHash(window.location.hash)
        if (!linked) return
        setOpenSteps(withStepOpen(openRef.current, linked))
        requestAnimationFrame(() => document.getElementById(stepDomId(linked))?.scrollIntoView({ block: 'start' }))
    }, [setOpenSteps])

    function pointAt(stepId: string) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${guideStepHash(stepId)}`)
    }

    return (
        <StreamCard title="Guide" description="Step by step from nothing to live.">
            <div className="flex flex-wrap gap-2 text-xs">
                <button
                    type="button"
                    onClick={() => setOpenSteps(guideStepIds())}
                    className="min-h-11 rounded-md border border-hairline/10 px-3 text-muted-foreground hover:text-foreground cursor-pointer sm:min-h-8"
                >
                    Expand all
                </button>
                <button
                    type="button"
                    onClick={() => setOpenSteps([])}
                    className="min-h-11 rounded-md border border-hairline/10 px-3 text-muted-foreground hover:text-foreground cursor-pointer sm:min-h-8"
                >
                    Collapse all
                </button>
            </div>
            <ol className="space-y-2">
                {GUIDE_STEPS.map((step, index) => (
                    <GuideStepItem
                        key={step.id}
                        step={step}
                        number={index + 1}
                        expanded={openSteps.includes(step.id)}
                        desktop={desktop}
                        onToggle={() => setOpenSteps(toggleStep(openSteps, step.id))}
                        onLink={() => {
                            setOpenSteps(withStepOpen(openSteps, step.id))
                            pointAt(step.id)
                        }}
                    />
                ))}
            </ol>
        </StreamCard>
    )
}

function stepDomId(stepId: string): string {
    return `guide-${stepId}`
}

function GuideStepItem({ step, number, expanded, desktop, onToggle, onLink }: {
    step: GuideStep
    number: number
    expanded: boolean
    desktop: boolean
    onToggle: () => void
    onLink: () => void
}) {
    const bodyId = `${stepDomId(step.id)}-body`
    const needsDesktop = step.desktopOnly && !desktop

    return (
        <li id={stepDomId(step.id)} className="min-w-0 scroll-mt-4 rounded-lg border border-hairline/10 bg-card/40">
            <div className="flex items-center gap-1 pr-2">
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={expanded ? bodyId : undefined}
                    onClick={onToggle}
                    className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left cursor-pointer"
                >
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{number}.</span>
                    <span className="min-w-0 text-sm font-medium text-foreground">{step.title}</span>
                    {step.desktopOnly && (
                        <span className="shrink-0 rounded-full border border-accent-500/40 bg-accent-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent-200">
                            Desktop only
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    aria-label={`Link to step ${number}`}
                    onClick={onLink}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer sm:size-8"
                >
                    <Link2 className="size-3.5" />
                </button>
            </div>
            {expanded && (
                <div id={bodyId} className="max-w-3xl space-y-2 px-3 pb-3 pl-9 text-sm text-foreground break-words">
                    {needsDesktop && (
                        <p className="rounded-lg border border-dashed border-accent-500/40 px-3 py-2 text-xs text-muted-foreground">
                            This step is done in the desktop launcher. In a browser you can read it, but the cam tool is not available.
                        </p>
                    )}
                    {step.blocks.map((block, index) => <GuideBlockView key={index} block={block} desktop={desktop} />)}
                    {needsDesktop && <LauncherLink />}
                </div>
            )}
        </li>
    )
}

function GuideBlockView({ block, desktop }: { block: GuideBlock; desktop: boolean }) {
    if (block.kind === 'text') return <p>{block.text}</p>
    if (block.kind === 'list') {
        return (
            <ul className="list-disc space-y-1 pl-5">
                {block.items.map(item => <li key={item}>{item}</li>)}
            </ul>
        )
    }
    return desktop
        ? <p className="text-xs text-muted-foreground">You are using the desktop launcher already.</p>
        : <LauncherLink />
}

function LauncherLink() {
    return (
        <a
            href={DESKTOP_LAUNCHER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25"
        >
            <Download className="size-3.5" /> Get the desktop launcher
        </a>
    )
}
