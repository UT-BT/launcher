import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import type { TutorialStep } from './mapsTutorialSteps'

const HIGHLIGHT_CLASSES = [
    'utbt-tutorial-highlight',
    'ring-2',
    'ring-blue-400',
    'ring-offset-2',
    'ring-offset-background',
    'rounded-md',
    'animate-pulse',
]

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

    // Apply highlight + scroll-into-view + lifecycle hooks for the active step.
    // Deps: only the step index. Re-running on every parent render would loop
    // because onEnter handlers commonly call setState.
    useEffect(() => {
        const active = stepsRef.current[step]
        if (!active) return
        active.onEnter?.()

        const el = active.targetRef?.current
        if (el) {
            el.classList.add(...HIGHLIGHT_CLASSES)
            // Wait a tick so any onEnter-triggered panel open has rendered.
            const id = window.setTimeout(() => {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }, 50)
            return () => {
                window.clearTimeout(id)
                el.classList.remove(...HIGHLIGHT_CLASSES)
                active.onExit?.()
            }
        }

        return () => {
            active.onExit?.()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    return (
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
    )
}
