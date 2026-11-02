import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'
import { useDeviceEnvironment } from '@/app/device/useDeviceEnvironment'

const HIGHLIGHT_ATTR = 'data-tutorial-highlight'

export interface TutorialStep {
    id: string
    title: string
    body: React.ReactNode
    targetRef?: React.RefObject<HTMLElement | null>
    targetRefs?: React.RefObject<HTMLElement | null>[]
    onEnter?: () => void
    onExit?: () => void
}

interface TutorialProps {
    steps: TutorialStep[]
    step: number
    setStep: (next: number) => void
    onClose: () => void
    ariaLabel: string
}

export function Tutorial({ steps, step, setStep, onClose, ariaLabel }: TutorialProps) {
    const current = steps[step]
    const total = steps.length
    const isFirst = step === 0
    const isLast = step === total - 1

    const stepsRef = useRef(steps)
    stepsRef.current = steps

    const touch = useDeviceEnvironment(env => env.touch)
    const panelRef = useRef<HTMLDivElement>(null)
    useModalBehaviour(panelRef, !!current, onClose, touch)

    useEffect(() => {
        const main = document.querySelector('main') as HTMLElement | null
        if (!main) return
        const prev = main.style.zIndex
        main.style.zIndex = 'auto'
        return () => { main.style.zIndex = prev }
    }, [])

    type Rect = { top: number; left: number; width: number; height: number }
    const [rects, setRects] = useState<Rect[]>([])

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

        const prevStyles = els.map(el => ({
            position: el.style.position,
            zIndex: el.style.zIndex,
        }))
        els.forEach(el => {
            el.setAttribute(HIGHLIGHT_ATTR, 'true')
            el.style.position = 'relative'
            el.style.zIndex = '60'
        })

        const updateRects = () => {
            setRects(els.map(el => {
                const r = el.getBoundingClientRect()
                return {
                    top: r.top,
                    left: r.left,
                    width: r.width,
                    height: r.height,
                }
            }))
        }
        const scrollId = window.setTimeout(() => {
            els[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
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

    const handleSkip = () => onClose()
    const handlePrev = () => { if (!isFirst) setStep(step - 1) }
    const handleNext = () => {
        if (isLast) onClose()
        else setStep(step + 1)
    }

    return createPortal(
        <>
            <div
                aria-hidden
                className="fixed inset-0 bg-black/65 backdrop-blur-[2px] touch:backdrop-filter-none z-[5] pointer-events-none"
            />
            {rects.map((r, i) => (
                <div
                    key={i}
                    aria-hidden
                    className="utbt-tutorial-ring fixed pointer-events-none z-[70]"
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
                aria-label={ariaLabel}
                data-modal-backdrop
                className="fixed bottom-[calc(1.5rem_+_var(--safe-area-bottom))] right-[calc(1.5rem_+_var(--safe-area-right))] z-[80] w-80 max-w-[calc(100vw-3rem)]"
            >
                <div
                    ref={panelRef}
                    tabIndex={-1}
                    className="flex flex-col max-h-[calc(100dvh_-_var(--top-bar-offset)_-_3rem_-_var(--safe-area-bottom))] bg-card border border-accent-500/40 rounded-xl shadow-2xl"
                >
                    <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-2 border-b border-hairline/10">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-300">
                            Tutorial · {step + 1} / {total}
                        </span>
                        <button
                            type="button"
                            onClick={handleSkip}
                            aria-label="Close tutorial"
                            className="modal-close p-1 rounded hover:bg-hairline/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>

                    <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-2">
                        <h3 className="text-sm font-bold text-foreground">{current.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{current.body}</p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 border-t border-hairline/10 bg-muted/30">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSkip}
                            className="touch:h-11 text-muted-foreground hover:text-foreground"
                        >
                            Skip
                        </Button>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePrev}
                                disabled={isFirst}
                                className="touch:h-11 text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                                <ChevronLeft className="size-4" />
                                Prev
                            </Button>
                            <Button size="sm" onClick={handleNext} className="touch:h-11">
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
            </div>
        </>,
        document.body,
    )
}
