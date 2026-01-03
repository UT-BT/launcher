import { FaCloudUploadAlt } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { UploadLogModal } from './UploadLogModal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useTitlebarContext } from './TitlebarContext'

export const UploadLogButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const { areButtonsDisabled } = useTitlebarContext()

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const logs = await window.conveyor.app.getUploadLogs()
                const uploading = logs.some((log) => log.status === 'uploading')
                setIsUploading(uploading)
            } catch (error) {
                console.error('Failed to check upload status:', error)
            }
        }

        checkStatus()
        const interval = setInterval(checkStatus, 2000)
        return () => clearInterval(interval)
    }, [])

    return (
        <>
            <Tooltip content="Demo Uploads" side="bottom">
                <button
                    className={`titlebar-action-button ${isUploading ? 'is-uploading' : ''} ${areButtonsDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !areButtonsDisabled && setIsModalOpen(true)}
                    aria-label="Demo Uploads"
                    disabled={areButtonsDisabled}
                >
                    <FaCloudUploadAlt className={isUploading ? 'animate-pulse' : ''} />
                </button>
            </Tooltip>
            <UploadLogModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    )
}
