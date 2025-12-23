import { useEffect, useState, useRef } from 'react'
import { UploadLogEntry } from '@/lib/main/demo-watcher-service'
import { FaTimes, FaCheckCircle, FaExclamationCircle, FaSpinner, FaCloudUploadAlt } from 'react-icons/fa'
import { Button } from '@/app/components/ui/button'
import { uploadDemo } from '@/app/utils/api'
import { cn } from '@/lib/utils'

interface UploadLogModalProps {
    isOpen: boolean
    onClose: () => void
}

export const UploadLogModal = ({ isOpen, onClose }: UploadLogModalProps) => {
    const [logs, setLogs] = useState<UploadLogEntry[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        await handleFiles(files)
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files)
            await handleFiles(files)
        }
    }

    const handleFiles = async (files: File[]) => {
        const demFiles = files.filter(f => f.name.toLowerCase().endsWith('.dem'))
        if (demFiles.length === 0) return

        const auth = await window.auth.getProfile()
        if (!auth) {
            console.error('User not logged in')
            return
        }

        for (const file of demFiles) {
            const filename = file.name
            const timestamp = new Date().toISOString()

            try {
                await window.conveyor.app.addUploadLog({
                    filename,
                    status: 'uploading',
                    timestamp
                })

                fetchLogs()

                const blob = new Blob([await file.arrayBuffer()])
                await uploadDemo(blob, filename, auth.accessToken)

                await window.conveyor.app.updateUploadLogStatus(filename, 'success')
            } catch (error: any) {
                console.error('Manual upload failed:', error)
                await window.conveyor.app.updateUploadLogStatus(filename, 'failed', error.message)
            }
        }
        fetchLogs()
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
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

                <div className="p-4 border-b border-border">
                    <input
                        type="file"
                        multiple
                        accept=".dem"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                    />
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200",
                            isDragging
                                ? "border-blue-500 bg-blue-500/10 scale-[1.02]"
                                : "border-white/10 hover:border-white/20 hover:bg-white/5"
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-full bg-blue-500/10 text-blue-500 mb-2",
                            isDragging && "animate-bounce"
                        )}>
                            <FaCloudUploadAlt className="size-8" />
                        </div>
                        <div className="text-sm font-medium">Click to select or drag and drop</div>
                        <div className="text-xs text-muted-foreground">UT99 Demo files (.dem) only</div>
                    </div>
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
