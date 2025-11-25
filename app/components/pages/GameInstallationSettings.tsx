import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { ErrorModal } from '@/app/components/ErrorModal'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'

interface GameInstallationSettingsProps {
    onBack: () => void
}

export function GameInstallationSettings({ onBack }: GameInstallationSettingsProps) {
    const [installPath, setInstallPath] = useState('')
    const [patchVersion, setPatchVersion] = useState('')
    const [downloading, setDownloading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [showError, setShowError] = useState(false)
    const [patches, setPatches] = useState<any[]>([])
    const [installingPatch, setInstallingPatch] = useState<string | null>(null)
    const [patchInstallStatus, setPatchInstallStatus] = useState('')
    const [patchProgress, setPatchProgress] = useState(0)
    const [showRcWarning, setShowRcWarning] = useState(false)
    const [pendingPatch, setPendingPatch] = useState<any>(null)
    const [announcerProgress, setAnnouncerProgress] = useState(0)
    const [isInstallingAnnouncer, setIsInstallingAnnouncer] = useState(false)

    useEffect(() => {
        loadSettings()
        loadPatches()

        const removeListener = window.utInstall?.onIsoDownloadProgress((data) => {
            setProgress(data.progress)
            setStatus(`Downloading... ${(data.downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(data.totalBytes / 1024 / 1024).toFixed(1)} MB`)
        })

        const removePatchStatusListener = window.utPatch?.onPatchInstallStatus((data) => {
            if (data.status === 'downloading') {
                setPatchInstallStatus('Downloading patch...')
            } else if (data.status === 'verifying') {
                setPatchInstallStatus('Verifying download...')
            } else if (data.status === 'extracting') {
                setPatchInstallStatus('Extracting files...')
            } else if (data.status === 'complete') {
                setPatchInstallStatus('Installation complete')
                setInstallingPatch(null)
                setPatchProgress(0)
                loadSettings()
            } else if (data.status === 'error') {
                setPatchInstallStatus('Error: ' + (data.message || 'Installation failed'))
                setInstallingPatch(null)
                setPatchProgress(0)
            }
        })

        const removePatchProgressListener = window.utPatch?.onPatchInstallProgress((data) => {
            setPatchProgress(data.progress)
        })

        const removeAnnouncerProgressListener = window.utPatch?.onAnnouncerInstallProgress((data) => {
            setIsInstallingAnnouncer(true)
            setAnnouncerProgress(data.progress)
        })

        const removeAnnouncerCompleteListener = window.utPatch?.onAnnouncerInstallComplete(() => {
            setIsInstallingAnnouncer(false)
            setAnnouncerProgress(0)
        })

        return () => {
            removeListener?.()
            removePatchStatusListener?.()
            removePatchProgressListener?.()
            removeAnnouncerProgressListener?.()
            removeAnnouncerCompleteListener?.()
        }
    }, [])

    const loadPatches = async () => {
        const patchList = await window.conveyor.app.fetchPatches()
        setPatches(patchList || [])
    }

    const loadSettings = async () => {
        const path = await window.conveyor.app.getUt99InstallPath()
        setInstallPath(path || '')

        const patch = await window.conveyor.app.getInstalledPatch()
        setPatchVersion(patch?.tag || 'Unknown')
    }

    const handleDownload = async () => {
        setDownloading(true)
        setStatus('Checking existing files...')
        setProgress(0)
        try {
            await window.conveyor.app.downloadUt99Iso()
            setStatus('Mounting ISO and starting installer...')
            await window.conveyor.app.mountAndRunUt99Iso()
            setStatus('Installation complete. Please select the installation directory below.')
            setDownloading(false)
        } catch (err: any) {
            setStatus('Error: ' + (err.message || 'Unknown error'))
            setDownloading(false)
        }
    }

    const handleCancel = async () => {
        await window.conveyor.app.cancelUt99Download()
        setDownloading(false)
        setStatus('Cancelled')
    }

    const handleBrowse = async () => {
        const path = await window.conveyor.app.selectInstallDirectory()
        if (path) {
            setInstallPath(path)
            const result = await window.conveyor.app.validateAndSetInstallPath(path)
            if (result.success) {
                setPatchVersion(result.version || 'Unknown')
            } else {
                setErrorMessage(result.error || 'Invalid Unreal Tournament 1999 directory. Please select a valid directory.')
                setShowError(true)
                loadSettings()
            }
        }
    }

    const handleInstallPatch = async (patch: any) => {
        if (!installPath) {
            setErrorMessage('Please select a valid installation directory first.')
            setShowError(true)
            return
        }

        if (patch.channel === 'rc') {
            setPendingPatch(patch)
            setShowRcWarning(true)
            return
        }

        await performPatchInstall(patch)
    }

    const performPatchInstall = async (patch: any) => {
        setInstallingPatch(patch.tag)
        setPatchInstallStatus('Preparing...')
        setPatchProgress(0)

        try {
            await window.conveyor.app.installPatch(patch)
        } catch (err: any) {
            setErrorMessage('Failed to install patch: ' + (err.message || 'Unknown error'))
            setShowError(true)
            setInstallingPatch(null)
            setPatchProgress(0)
        }
    }

    const handleConfirmRc = () => {
        setShowRcWarning(false)
        if (pendingPatch) {
            performPatchInstall(pendingPatch)
            setPendingPatch(null)
        }
    }

    const handleCancelRc = () => {
        setShowRcWarning(false)
        setPendingPatch(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                    <ArrowLeft className="size-6" />
                </button>
                <h2 className="text-3xl font-bold tracking-tight">Game Installation</h2>
            </div>

            <div className="space-y-6">
                <div className="p-6 rounded-xl bg-card border border-border space-y-4">
                    <h3 className="text-xl font-semibold">Install UT99</h3>
                    <p className="text-sm text-muted-foreground">
                        Don't have the game installed? Download and install the Game of the Year Edition.
                    </p>

                    {!downloading && !status ? (
                        <Button onClick={handleDownload} disabled={downloading}>
                            Download & Install UT99
                        </Button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{status}</span>
                                {downloading && <span>{Math.round(progress)}%</span>}
                            </div>
                            {downloading && (
                                <>
                                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <Button variant="destructive" size="sm" onClick={handleCancel}>
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {!downloading && status && (
                                <Button onClick={handleDownload} variant="outline" size="sm">
                                    Install Again
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 rounded-xl bg-card border border-border space-y-4">
                    <h3 className="text-xl font-semibold">Installation Directory</h3>
                    <p className="text-sm text-muted-foreground">
                        Select the directory where Unreal Tournament is installed.
                    </p>
                    <div className="flex gap-4">
                        <Input
                            value={installPath}
                            readOnly
                            placeholder="No directory selected"
                            className="flex-1"
                        />
                        <Button onClick={handleBrowse}>
                            Browse...
                        </Button>
                    </div>

                    {isInstallingAnnouncer && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Installing custom announcer...</span>
                                <span>{Math.round(announcerProgress)}%</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${announcerProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 rounded-xl bg-card border border-border space-y-4">
                    <h3 className="text-xl font-semibold">Available Patches</h3>
                    <p className="text-sm text-muted-foreground">
                        Select the version of the game that you would like to play on.<br />Installing and changing patches has <span className="italic">no</span> effect on your graphics settings, keybinds, and only changes the game engine.<br /><br /><b>Patching is completely safe.</b>
                    </p>

                    {patches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Loading patches...</p>
                    ) : (
                        <div className="space-y-2">
                            {patches.map((patch) => {
                                const isInstalled = patchVersion === patch.tag
                                const isInstalling = installingPatch === patch.tag

                                return (
                                    <div key={patch.tag} className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <div className="font-semibold">{patch.tag}</div>
                                                </div>
                                                {isInstalled && !isInstalling && (
                                                    <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">Installed</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={patch.release_notes_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    Release Notes
                                                </a>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleInstallPatch(patch)}
                                                    disabled={isInstalling || !installPath}
                                                >
                                                    {isInstalling ? 'Installing...' : isInstalled ? 'Reinstall' : 'Install'}
                                                </Button>
                                            </div>
                                        </div>

                                        {isInstalling && (
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{patchInstallStatus}</span>
                                                    {patchProgress > 0 && <span>{Math.round(patchProgress)}%</span>}
                                                </div>
                                                {patchProgress > 0 && (
                                                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary transition-all duration-300"
                                                            style={{ width: `${patchProgress}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <ErrorModal
                isOpen={showError}
                onClose={() => setShowError(false)}
                title="Installation Directory Error"
                message={errorMessage}
            />

            <ConfirmModal
                isOpen={showRcWarning}
                onClose={handleCancelRc}
                onConfirm={handleConfirmRc}
                title="Release Candidate Patch"
                message="This patch is a Release Candidate. There could be bugs or issues, or the patch could be blacklisted from anti-cheat at any moment. Use at your own risk."
                confirmText="Install Anyway"
                cancelText="Cancel"
                variant="error"
            />
        </div>
    )
}
