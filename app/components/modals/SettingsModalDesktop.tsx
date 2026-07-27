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
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" backdropClassName="z-[100]" className="w-[95%] lg:w-[95%] max-w-[1400px] max-h-[90vh] h-full p-0 overflow-hidden">
            <div className="@container/settings h-full overflow-hidden">
                <DesktopSettings initialSection={initialSection} unlockExclusive={unlockExclusive} installationStatus={installationStatus} />
            </div>
        </Modal>
    )
}