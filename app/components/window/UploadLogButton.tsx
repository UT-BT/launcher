import { FaCloudUploadAlt } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { UploadLogModal } from './UploadLogModal'
import { Tooltip } from '@/app/components/ui/tooltip'

export const UploadLogButton = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

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
                    className={`titlebar-action-button ${isUploading ? 'is-uploading' : ''}`}
                    onClick={() => setIsModalOpen(true)}
                    aria-label="Demo Uploads"
                >
                    <FaCloudUploadAlt className={isUploading ? 'animate-pulse' : ''} />
                </button>
            </Tooltip>
            <UploadLogModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    )
}
