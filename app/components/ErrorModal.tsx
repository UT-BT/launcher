import { Button } from '@/app/components/ui/button'
import { X, AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ErrorModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    message: string
    actionLabel?: string
    onAction?: () => void
    fullScreen?: boolean
    disableClose?: boolean
}

export function ErrorModal({
    isOpen,
    onClose,
    title = "Error",
    message,
    actionLabel,
    onAction,
    fullScreen = false,
    disableClose = false
}: ErrorModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    // Handle Escape key to close modal
    useEffect(() => {
        if (!isOpen || disableClose) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Check if this is the top-most modal
                const backdrops = document.querySelectorAll('[data-modal-backdrop]')
                const isTopMost = backdrops[backdrops.length - 1] === modalRef.current?.parentElement

                if (isTopMost) {
                    e.preventDefault()
                    e.stopImmediatePropagation()
                    onClose()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown, true)
        return () => document.removeEventListener('keydown', handleKeyDown, true)
    }, [isOpen, onClose, disableClose])

    useEffect(() => {
        if (!isOpen || !modalRef.current) return

        const modalElement = modalRef.current
        const focusableElements = modalElement.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (firstElement) {
            firstElement.focus()
        } else {
            modalElement.focus()
        }

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !firstElement || !lastElement) return

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault()
                    lastElement?.focus()
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault()
                    firstElement?.focus()
                }
            }
        }

        modalElement.addEventListener('keydown', handleTabKey)
        return () => modalElement.removeEventListener('keydown', handleTabKey)
    }, [isOpen])

    if (!isOpen) return null

    const containerClasses = fullScreen
        ? "fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
        : "fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-64 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"

    return (
        <div data-modal-backdrop className={containerClasses}>
            <div ref={modalRef} tabIndex={-1} className="w-full max-w-md bg-card border border-destructive/20 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-destructive/10">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="size-5" />
                        <h3 className="font-bold text-lg truncate">{title}</h3>
                    </div>
                    {!disableClose && (
                        <Button ref={closeButtonRef} variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10" aria-label="Close modal">
                            <X className="size-4" />
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="text-center">
                        <p className="text-white/90 text-lg">{message}</p>
                    </div>

                    <div className="flex justify-center gap-3">
                        {!disableClose && (
                            <Button
                                onClick={onClose}
                                variant="secondary"
                                className="min-w-[100px] border border-white/5"
                            >
                                Close
                            </Button>
                        )}
                        {onAction && actionLabel && (
                            <Button
                                onClick={onAction}
                                className="min-w-[100px]"
                            >
                                {actionLabel}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
