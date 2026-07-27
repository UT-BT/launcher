import { Modal } from '@/app/components/ui/modal'
import { WebSettings } from '@/app/components/pages/SettingsWeb'

interface SettingsModalWebProps {
    isOpen: boolean
    onClose: () => void
    initialSection?: string
    unlockExclusive?: boolean
}

export function SettingsModalWeb({ isOpen, onClose, initialSection, unlockExclusive }: SettingsModalWebProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" backdropClassName="z-[100]" className="w-[95%] lg:w-[95%] max-w-[1400px] max-h-[90vh] h-full p-0 overflow-hidden">
            <div className="@container/settings h-full overflow-hidden">
                <WebSettings initialSection={initialSection} unlockExclusive={unlockExclusive} />
            </div>
        </Modal>
    )
}