import { Button } from '@/app/components/ui/button'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    className?: string
    footer?: React.ReactNode
    backdropClassName?: string
    offsetSidebar?: boolean
    maxWidth?: string
    maxHeight?: string
    leftAction?: React.ReactNode
    portal?: boolean
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    className,
    footer,
    backdropClassName,
    offsetSidebar,
    maxWidth,
    maxHeight,
    leftAction,
    portal,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!isOpen) return

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
    }, [isOpen, onClose])

    useEffect(() => {
        if (!isOpen || !modalRef.current) return

        const modalElement = modalRef.current
        const focusableElements = modalElement.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
        )

        if (focusableElements.length === 0) {
            modalElement.focus()
            return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (firstElement) {
            firstElement.focus()
        }

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return

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

    const overlay = (
        <div
            data-modal-backdrop
            className={cn(
                "fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200",
                offsetSidebar && "lg:pl-64",
                backdropClassName
            )}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                style={{
                    maxWidth: maxWidth,
                    maxHeight: maxHeight || '90vh'
                } as React.CSSProperties}
                className={cn(
                    "w-[95%] lg:w-[70%] max-w-7xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50 shrink-0 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        {leftAction}
                        <h3 className="font-bold text-lg truncate">{title}</h3>
                    </div>
                    <Button
                        ref={closeButtonRef}
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-background/80 shrink-0"
                        aria-label="Close modal"
                    >
                        <X className="size-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                    {children}
                </div>

                {/* Footer */}
                {footer === undefined ? (
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end shrink-0">
                        <Button
                            onClick={onClose}
                            variant="secondary"
                        >
                            Close
                        </Button>
                    </div>
                ) : footer}
            </div>
        </div>
    )

    return portal ? createPortal(overlay, document.body) : overlay
}