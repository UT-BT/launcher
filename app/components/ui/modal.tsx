import { Button } from '@/app/components/ui/button'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { getDeviceEnvironment, subscribeDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import { sheetBounds } from './modalSheet'

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
    closeOnBackdrop?: boolean
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
    portal = true,
    closeOnBackdrop = true,
}: ModalProps) {
    const backdropRef = useRef<HTMLDivElement>(null)
    const modalRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const pressedBackdrop = useRef(false)

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

    useEffect(() => {
        const backdrop = backdropRef.current
        if (!isOpen || !backdrop) return

        const followVisibleArea = () => {
            const bounds = sheetBounds(getDeviceEnvironment().viewport)
            backdrop.style.setProperty('--modal-visible-top', bounds && `${bounds.top}px`)
            backdrop.style.setProperty('--modal-visible-height', bounds && `${bounds.height}px`)
        }

        followVisibleArea()
        return subscribeDeviceEnvironment(followVisibleArea)
    }, [isOpen])

    if (!isOpen) return null

    const overlay = (
        <div
            ref={backdropRef}
            data-modal-backdrop
            onPointerDown={e => { pressedBackdrop.current = e.target === e.currentTarget }}
            onClick={e => {
                if (closeOnBackdrop && pressedBackdrop.current && e.target === e.currentTarget) onClose()
            }}
            className={cn(
                "modal-backdrop fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm touch:backdrop-filter-none p-4",
                offsetSidebar && "pl-[calc(var(--sidebar-width,0px)_+_1rem)]",
                backdropClassName
            )}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                style={{
                    maxWidth: maxWidth,
                    maxHeight: maxHeight || '90dvh'
                } as React.CSSProperties}
                className={cn(
                    "modal-panel w-[95%] lg:w-[70%] max-w-7xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col touch:backdrop-filter-none",
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
                        className="modal-close h-8 w-8 rounded-full hover:bg-background/80 shrink-0"
                        aria-label="Close modal"
                    >
                        <X className="size-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
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