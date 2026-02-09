import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/shared/Modal'
import { Checkbox } from '@/app/components/ui/checkbox'

interface GameInstallLegalModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

export function GameInstallLegalModal({
    isOpen,
    onClose,
    onConfirm
}: GameInstallLegalModalProps) {
    const [accepted, setAccepted] = useState(false)

    const handleConfirm = () => {
        if (accepted) {
            onConfirm()
            setAccepted(false)
        }
    }

    const handleClose = () => {
        setAccepted(false)
        onClose()
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Legal Notice"
            closeOnOverlayClick={false}
        >
            <div className="space-y-4">
                <div className="space-y-2 text-sm text-foreground/90 text-left">
                    <p>
                        Please read the following important information regarding the installation of Unreal Tournament.
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-left">
                        <li>
                            The game is strictly <strong>Epic Games' property</strong>.
                        </li>
                        <li>
                            You are installing a copy distributed <strong>free of charge for personal use only</strong>.
                        </li>
                        <li>
                            The <a href="https://legal.epicgames.com/en-US/epicgames/tos" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold underline decoration-blue-500 underline-offset-2 hover:text-blue-400">Epic Games Terms of Service</a> applies to the use and distribution of Unreal Tournament. These terms supersede any other end user agreement that may accompany the game.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                        id="legal-accept"
                        checked={accepted}
                        onCheckedChange={(checked) => setAccepted(checked as boolean)}
                    />
                    <label
                        htmlFor="legal-accept"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                        I accept the Epic Games Terms of Service
                    </label>
                </div>

                <div className="modal-actions pt-2">
                    <Button onClick={handleConfirm} disabled={!accepted}>
                        Install
                    </Button>
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
