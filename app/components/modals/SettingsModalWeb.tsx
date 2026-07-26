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
        <Modal isOpen={isOpen} onClose={onClose} title="Settings" backdropClassName="z-[100]" className="max-w-[95vw] 2xl:max-w-[70vw] max-h-[90vh] h-full p-0 overflow-hidden">
            <div className="h-full overflow-hidden">
                <WebSettings initialSection={initialSection} unlockExclusive={unlockExclusive} />
            </div>
        </Modal>
    )
}