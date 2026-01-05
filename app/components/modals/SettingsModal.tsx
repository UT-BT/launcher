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
            backdropClassName="z-[100]"
            className="max-w-[calc(95vw/var(--app-scale,1))] 2xl:max-w-[calc(70vw/var(--app-scale,1))] max-h-[calc(90vh/var(--app-scale,1))] h-full p-0 overflow-hidden"
        >
            <div className="h-full overflow-hidden">
                <Settings initialSection={initialSection} />
            </div>
        </Modal>
    )
}
