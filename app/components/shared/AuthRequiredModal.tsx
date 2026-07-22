import { LogIn } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { platformAuth } from '@/app/platform'

export const LOGIN_REQUIRED_EVENT = 'utbt:login-required'

export function requestLogin(request: LoginRequest): void {
    window.dispatchEvent(new CustomEvent<LoginRequest>(LOGIN_REQUIRED_EVENT, { detail: request }))
}

export interface LoginRequest {
    feature: string
    description?: string
}

export function AuthRequiredModal({ request, onClose }: { request: LoginRequest | null; onClose: () => void }) {
    return (
        <Modal
            isOpen={request !== null}
            onClose={onClose}
            title={request ? `Sign in to ${request.feature}` : 'Sign in'}
            maxWidth="28rem"
            offsetSidebar
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => void platformAuth.login()}>
                        <LogIn className="size-4" />
                        Continue with Discord
                    </Button>
                </div>
            }
        >
            <p className="text-sm leading-relaxed text-muted-foreground">
                {request?.description ?? 'Sign in with Discord to use this account feature. You will return to this page afterwards.'}
            </p>
        </Modal>
    )
}