import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { closeLegacyCard, loadLegacyInstall, removeLegacyCopy, useLegacyInstall } from './legacyInstall'

const OFFER_DELAY_MS = 1_200

const FOOTER_CLASS = 'p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0'

export function LegacyInstallCard() {
    const { uninstallerName, cardOpen, phase, pinLost } = useLegacyInstall()

    useEffect(() => {
        const timer = setTimeout(loadLegacyInstall, OFFER_DELAY_MS)
        return () => clearTimeout(timer)
    }, [])

    if (!cardOpen) return null

    const removing = phase === 'removing'
    const remove = () => { void removeLegacyCopy() }

    const title = (() => {
        switch (phase) {
            case 'removed':
                return 'Old copy removed'
            case 'declined':
                return 'Old copy kept'
            case 'failed':
                return "Couldn't remove the old copy"
            default:
                return 'UTBT now updates itself'
        }
    })()

    const footer = (() => {
        if (phase === 'removed') {
            return (
                <div className={FOOTER_CLASS}>
                    <Button onClick={closeLegacyCard}>Done</Button>
                </div>
            )
        }
        if (phase === 'declined' || phase === 'failed') {
            return (
                <div className={FOOTER_CLASS}>
                    <Button variant="secondary" onClick={closeLegacyCard}>Close</Button>
                    <Button onClick={remove}>Try again</Button>
                </div>
            )
        }
        return (
            <div className={FOOTER_CLASS}>
                <Button variant="secondary" onClick={closeLegacyCard} disabled={removing}>Not now</Button>
                <Button onClick={remove} disabled={removing}>
                    {removing && <Loader2 className="size-4 animate-spin" />}
                    {removing ? 'Removing…' : 'Remove old copy'}
                </Button>
            </div>
        )
    })()

    return (
        <Modal
            isOpen
            portal
            onClose={closeLegacyCard}
            title={title}
            footer={footer}
            maxWidth="480px"
            backdropClassName="z-[110]"
        >
            <div className="space-y-4 text-sm">
                {(phase === 'idle' || removing) && (
                    <>
                        <p className="text-muted-foreground leading-relaxed">
                            This update introduces self-updating for UTBT. You will no longer see installers or update prompts.
                        </p>
                        <p className="text-foreground leading-relaxed">
                            The old copy of UTBT from before is still on your PC. Do you want to remove it?
                        </p>
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <ShieldCheck className="size-4 shrink-0 text-primary" />
                            <span>
                                {removing
                                    ? 'Click Yes when Windows asks. This only takes a few seconds.'
                                    : `Windows will ask once to allow "${uninstallerName ?? 'Uninstall utbt.exe'}".`}
                            </span>
                        </div>
                    </>
                )}

                {phase === 'removed' && (
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-2 text-muted-foreground leading-relaxed">
                            <p>The old copy of UTBT is gone. You're all set.</p>
                            {pinLost && (
                                <p>Windows removed your taskbar pin along with the old copy. Right-click UTBT on your taskbar and choose Pin to taskbar to get it back.</p>
                            )}
                        </div>
                    </div>
                )}

                {(phase === 'declined' || phase === 'failed') && (
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-muted-foreground leading-relaxed">
                            {phase === 'declined'
                                ? "Windows didn't get permission, so the old copy is still on your PC. You can remove it any time from Settings → General."
                                : 'Something stopped the removal. Try again, or uninstall the older UTBT from Windows Settings → Apps → Installed apps.'}
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    )
}
