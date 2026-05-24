import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import type { TutorialStep } from './mapsTutorialSteps'

const HIGHLIGHT_ATTR = 'data-tutorial-highlight'

interface MapsTutorialProps {
    steps: TutorialStep[]
    step: number
    setStep: (next: number) => void
    onClose: () => void
}

export function MapsTutorial({ steps, step, setStep, onClose }: MapsTutorialProps) {
    const current = steps[step]
    const total = steps.length
    const isFirst = step === 0
    const isLast = step === total - 1

    // Latest steps array via ref so the effect can read it without depending on
    // a new array reference each render (avoids infinite re-renders when
    // onEnter triggers a setState in the parent).
    const stepsRef = useRef(steps)
    stepsRef.current = steps

    // While the tutorial is mounted, drop <main>'s z-index. <main> in
    // AppLayout has `relative z-10`, which creates a stacking context that
    // traps the dim overlay BENEATH all page content. Removing its z-index
    // dissolves that context so the body-portaled overlay can sit above the
    // page chrome while the highlighted target's z-[60] still escapes above
    // the overlay.
    useEffect(() => {
        const main = document.querySelector('main') as HTMLElement | null
        if (!main) return
        const prev = main.style.zIndex
        main.style.zIndex = 'auto'
        return () => { main.style.zIndex = prev }
    }, [])

    // Rects of all highlighted targets for the active step, updated on
    // scroll/resize. Rendered as fixed-position portal rings so ancestor
    // overflow clipping can't hide them.
    type Rect = { top: number; left: number; width: number; height: number }
    const [rects, setRects] = useState<Rect[]>([])

    // Apply highlight + scroll-into-view + lifecycle hooks for the active step.
    // Deps: only the step index. Re-running on every parent render would loop
    // because onEnter handlers commonly call setState.
    useEffect(() => {
        const active = stepsRef.current[step]
        if (!active) {
            setRects([])
            return
        }
        active.onEnter?.()

        const refs = active.targetRefs ?? (active.targetRef ? [active.targetRef] : [])
        const els = refs
            .map(r => r.current)
            .filter((e): e is HTMLElement => !!e)

        if (els.length === 0) {
            setRects([])
            return () => {
                active.onExit?.()
            }
        }

        // Belt-and-suspenders z-index lift: data attribute (for CSS rule) +
        // inline style (in case some library replaces className/attributes
        // mid-step). React only manages style keys declared in JSX, so our
        // imperative position/zIndex inline style survives re-renders.
        const prevStyles = els.map(el => ({
            position: el.style.position,
            zIndex: el.style.zIndex,
        }))
        els.forEach(el => {
            el.setAttribute(HIGHLIGHT_ATTR, 'true')
            el.style.position = 'relative'
            el.style.zIndex = '60'
        })

        const getZoom = () => {
            const z = parseFloat(document.documentElement.style.zoom)
            return isNaN(z) ? 1 : z / 100
        }
        const updateRects = () => {
            const zoom = getZoom()
            setRects(els.map(el => {
                const r = el.getBoundingClientRect()
                return {
                    top: r.top / zoom,
                    left: r.left / zoom,
                    width: r.width / zoom,
                    height: r.height / zoom,
                }
            }))
        }
        // Wait a tick so any onEnter-triggered panel open has rendered.
        const scrollId = window.setTimeout(() => {
            els[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
            // Refresh rects after the smooth scroll settles.
            window.setTimeout(updateRects, 350)
        }, 50)
        updateRects()

        window.addEventListener('scroll', updateRects, true)
        window.addEventListener('resize', updateRects)

        return () => {
            window.clearTimeout(scrollId)
            window.removeEventListener('scroll', updateRects, true)
            window.removeEventListener('resize', updateRects)
            els.forEach((el, i) => {
                el.removeAttribute(HIGHLIGHT_ATTR)
                el.style.position = prevStyles[i].position
                el.style.zIndex = prevStyles[i].zIndex
            })
            setRects([])
            active.onExit?.()
        }
         
    }, [step])

    if (!current) return null

    const handleSkip = () => {
        onClose()
    }
    const handlePrev = () => {
        if (!isFirst) setStep(step - 1)
    }
    const handleNext = () => {
        if (isLast) {
            onClose()
        } else {
            setStep(step + 1)
        }
    }

    // Portal overlay + ring + card to document.body so they escape any
    // ancestor containing block (e.g. ancestors with transform/filter that
    // re-anchor `position: fixed` to themselves instead of the viewport).
    return createPortal(
        <>
            <div
                aria-hidden
                className="fixed inset-0 bg-black/65 backdrop-blur-[2px] z-[5] pointer-events-none animate-in fade-in duration-200"
            />
            {rects.map((r, i) => (
                <div
                    key={i}
                    aria-hidden
                    className="utbt-tutorial-ring fixed pointer-events-none z-[59]"
                    style={{
                        top: r.top - 4,
                        left: r.left - 4,
                        width: r.width + 8,
                        height: r.height + 8,
                        borderRadius: 8,
                    }}
                />
            ))}
            <div
                role="dialog"
                aria-label="Maps page tutorial"
                className={cn(
                    'fixed bottom-6 right-6 z-[60] w-80 max-w-[calc(100vw-3rem)]',
                    'bg-card border border-blue-500/40 rounded-xl shadow-2xl',
                    'animate-in fade-in slide-in-from-bottom-4 duration-200',
                )}
            >
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                        Tutorial · {step + 1} / {total}
                    </span>
                    <button
                        type="button"
                        onClick={handleSkip}
                        aria-label="Close tutorial"
                        className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>

                <div className="px-4 py-3 space-y-2">
                    <h3 className="text-sm font-bold text-white">{current.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{current.body}</p>
                </div>

                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/10 bg-muted/30">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSkip}
                        className="text-muted-foreground hover:text-white"
                    >
                        Skip
                    </Button>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrev}
                            disabled={isFirst}
                            className="text-muted-foreground hover:text-white disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" />
                            Prev
                        </Button>
                        <Button size="sm" onClick={handleNext}>
                            {isLast ? 'Done' : (
                                <>
                                    Next
                                    <ChevronRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </>,
        document.body,
    )
}
