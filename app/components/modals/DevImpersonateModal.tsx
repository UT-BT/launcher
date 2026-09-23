import { useEffect, useState } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { DEV_IMPERSONATE_EVENT, getImpersonatedUserId, setImpersonatedUserId } from '@/app/utils/devImpersonation'

export function DevImpersonateModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [userId, setUserId] = useState('')

    useEffect(() => {
        const onOpen = () => {
            setUserId(getImpersonatedUserId() ?? '')
            setIsOpen(true)
        }
        window.addEventListener(DEV_IMPERSONATE_EVENT, onOpen)
        return () => window.removeEventListener(DEV_IMPERSONATE_EVENT, onOpen)
    }, [])

    const apply = () => {
        setImpersonatedUserId(userId.trim() || null)
        window.location.reload()
    }

    const clear = () => {
        setImpersonatedUserId(null)
        window.location.reload()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Impersonate user (dev only)"
            maxWidth="28rem"
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={clear}>Clear</Button>
                    <Button onClick={apply}>Apply &amp; reload</Button>
                </div>
            }
        >
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
                Every API request authenticates as this discord_id instead of your own account.
                Requires DataService running locally with DEV_IMPERSONATION_ENABLED=1.
            </p>
            <Input
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="Discord user id"
                autoFocus
            />
        </Modal>
    )
}

export function DevImpersonationBanner() {
    const userId = getImpersonatedUserId()

    if (!userId) return null

    return (
        <div
            onClick={() => window.dispatchEvent(new CustomEvent(DEV_IMPERSONATE_EVENT))}
            className="relative z-[60] w-full bg-destructive/15 border-b border-destructive/40 px-6 py-2 cursor-pointer hover:bg-destructive/25 transition-colors"
        >
            <p className="text-sm font-semibold leading-tight text-center text-destructive">
                Impersonating user {userId} — click to change
            </p>
        </div>
    )
}
