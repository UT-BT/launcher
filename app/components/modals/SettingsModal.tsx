import { Modal } from '@/app/components/ui/modal'
import { Settings } from '@/app/components/pages/Settings'

interface SettingsModalProps {
    isOpen: boolean
    onClose: () => void
    initialSection?: string
}

export function SettingsModal({ isOpen, onClose, initialSection }: SettingsModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Settings"
            offsetSidebar
            backdropClassName="z-[100]"
            className="w-[95%] lg:w-[90%] max-w-7xl h-full p-0 overflow-hidden"
        >
            <div className="h-full overflow-hidden">
                <Settings initialSection={initialSection} />
            </div>
        </Modal>
    )
}
