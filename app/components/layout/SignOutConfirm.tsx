import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'

interface SignOutConfirmProps {
    onCancel: () => void
    onConfirm: () => void
}

export function SignOutConfirm({ onCancel, onConfirm }: SignOutConfirmProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useModalBehaviour(panelRef, true, onCancel)

    return createPortal(
        <div data-modal-backdrop className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm touch:backdrop-filter-none p-4 animate-in fade-in duration-200">
            <div ref={panelRef} tabIndex={-1} role="alertdialog" aria-labelledby="sign-out-title" className="w-full max-w-md max-h-full overflow-y-auto overscroll-contain bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-4">
                    <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 rounded-full bg-red-500/10 text-red-500 mb-2">
                            <LogOut className="size-8" />
                        </div>
                        <h3 id="sign-out-title" className="text-xl font-bold">Sign Out</h3>
                        <p className="text-muted-foreground">
                            Are you sure you want to sign out?
                            <br />
                            <br />
                            You will need to sign in again to access UTBT.
                        </p>
                    </div>
                    <div className="flex gap-3 justify-center pt-4">
                        <Button
                            variant="outline"
                            onClick={onCancel}
                            className="min-w-[100px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={onConfirm}
                            className="min-w-[100px]"
                        >
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
