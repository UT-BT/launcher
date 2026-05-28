import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

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
                className="fixed inset-0 bg-black/65 backdrop-blur-[2px] z-[5] pointer-events-none animate-in fade-in duration-200"
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
                className={cn(
                    'fixed bottom-6 right-6 z-[80] w-80 max-w-[calc(100vw-3rem)]',
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
