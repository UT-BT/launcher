import { Modal } from '@/app/components/ui/modal'
import { DesktopSettings } from '@/app/components/pages/SettingsDesktop'

interface SettingsModalDesktopProps {
    isOpen: boolean
    onClose: () => void
    initialSection?: string
    unlockExclusive?: boolean
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
}

export function SettingsModalDesktop({ isOpen, onClose, initialSection, unlockExclusive, installationStatus }: SettingsModalDesktopProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" backdropClassName="z-[100]" className="max-w-[95vw] 2xl:max-w-[70vw] max-h-[90vh] h-full p-0 overflow-hidden">
            <div className="h-full overflow-hidden">
                <DesktopSettings initialSection={initialSection} unlockExclusive={unlockExclusive} installationStatus={installationStatus} />
            </div>
        </Modal>
    )
}