import { useEffect, useState } from 'react'
import { UploadLogEntry } from '@/lib/main/demo-watcher-service'
import { FaTimes, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa'
import { Button } from '@/app/components/ui/button'

interface UploadLogModalProps {
    isOpen: boolean
    onClose: () => void
}

export const UploadLogModal = ({ isOpen, onClose }: UploadLogModalProps) => {
    const [logs, setLogs] = useState<UploadLogEntry[]>([])

    const fetchLogs = async () => {
        try {
            const uploadLogs = await window.conveyor.app.getUploadLogs()
            setLogs(uploadLogs)
        } catch (error) {
            console.error('Failed to fetch upload logs:', error)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchLogs()
            const interval = setInterval(fetchLogs, 2000)
            return () => clearInterval(interval)
        }
        return undefined
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        Demo Uploads
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {logs.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            No recent uploads.
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/5">
                                <div className="flex-none">
                                    {log.status === 'success' && <FaCheckCircle className="text-green-500 size-5" />}
                                    {log.status === 'failed' && <FaExclamationCircle className="text-red-500 size-5" />}
                                    {log.status === 'uploading' && <FaSpinner className="text-blue-500 size-5 animate-spin" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{log.filename}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString()}
                                        {log.error && <span className="text-red-400 ml-2">— {log.error}</span>}
                                    </div>
                                </div>
                                <div className="flex-none text-xs font-mono uppercase tracking-wider opacity-60">
                                    {log.status}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    )
}
