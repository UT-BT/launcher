import { FaCloudUploadAlt } from 'react-icons/fa'
import { useState } from 'react'
import { UploadLogModal } from './UploadLogModal'

export const UploadLogButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <>
            <button
                className="titlebar-action-button"
                onClick={() => setIsModalOpen(true)}
                aria-label="Demo Uploads"
            >
                <FaCloudUploadAlt />
            </button>
            <UploadLogModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    )
}
