import { Button } from '@/app/components/ui/button'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    className?: string
    footer?: React.ReactNode
    backdropClassName?: string
}

export function Modal({ isOpen, onClose, title, children, className, footer, backdropClassName }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                onClose()
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

    return (
        <div className={cn(
            "fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200",
            backdropClassName
        )}>
            <div
                ref={modalRef}
                tabIndex={-1}
                className={cn(
                    "w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]",
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50 shrink-0">
                    <h3 className="font-bold text-lg truncate">{title}</h3>
                    <Button
                        ref={closeButtonRef}
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-background/80"
                        aria-label="Close modal"
                    >
                        <X className="size-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
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
}
