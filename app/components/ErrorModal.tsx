import { Button } from '@/app/components/ui/button'
import { X, AlertTriangle } from 'lucide-react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'

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
    useModalBehaviour(modalRef, isOpen, disableClose ? undefined : onClose)

    if (!isOpen) return null

    const containerClasses = fullScreen
        ? "fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md touch:backdrop-filter-none p-4 animate-in fade-in duration-200"
        : "fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-[var(--sidebar-width,0px)] z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm touch:backdrop-filter-none p-4 animate-in fade-in duration-200"

    return createPortal(
        <div data-modal-backdrop className={containerClasses}>
            <div ref={modalRef} tabIndex={-1} className="w-full max-w-md max-h-full overflow-y-auto overscroll-contain bg-card border border-destructive/20 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-hairline/5 bg-destructive/10">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="size-5" />
                        <h3 className="font-bold text-lg truncate">{title}</h3>
                    </div>
                    {!disableClose && (
                        <Button variant="ghost" size="icon" onClick={onClose} className="modal-close h-8 w-8 rounded-full hover:bg-hairline/10" aria-label="Close modal">
                            <X className="size-4" />
                        </Button>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <div className="text-center">
                        <p className="text-foreground/90 text-lg">{message}</p>
                    </div>

                    <div className="flex justify-center gap-3">
                        {!disableClose && (
                            <Button
                                onClick={onClose}
                                variant="secondary"
                                className="min-w-[100px] border border-hairline/5"
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
        </div>,
        document.body
    )
}
