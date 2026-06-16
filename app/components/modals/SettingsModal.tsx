import { Modal } from '@/app/components/ui/modal'
import { Settings } from '@/app/components/pages/Settings'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    initialSection?: string
    unlockExclusive?: boolean
}

export function SettingsModal({ isOpen, onClose, initialSection, unlockExclusive }: SettingsModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Settings"
            backdropClassName="z-[100]"
            className="max-w-[95vw] 2xl:max-w-[70vw] max-h-[90vh] h-full p-0 overflow-hidden"
        >
            <div className="h-full overflow-hidden">
                <Settings initialSection={initialSection} unlockExclusive={unlockExclusive} />
            </div>
        </Modal>
    )
}
