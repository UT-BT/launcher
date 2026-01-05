import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Download, Folder, Package } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { ErrorModal } from '@/app/components/ErrorModal'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { SettingsSection, SettingsRow } from './settings/SettingsComponents'

export function GameInstallationSettings() {
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
    const [showUnsupported, setShowUnsupported] = useState(false)
    const downloadAttemptRef = useRef(0)

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

        const removePathUpdateListener = window.utPatch?.onInstallationPathUpdated(() => {
            loadSettings()
        })

        return () => {
            removeListener?.()
            removePatchStatusListener?.()
            removePatchProgressListener?.()
            removeAnnouncerProgressListener?.()
            removeAnnouncerCompleteListener?.()
            removePathUpdateListener?.()
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
        const attemptId = ++downloadAttemptRef.current
        setDownloading(true)
        setStatus('Checking existing files...')
        setProgress(0)
        try {
            await window.conveyor.app.downloadUt99Iso()
            if (downloadAttemptRef.current !== attemptId) return

            setStatus('Mounting ISO and starting installer...')
            await window.conveyor.app.mountAndRunUt99Iso()

            if (downloadAttemptRef.current !== attemptId) return
            setStatus('Installation complete. Please select the installation directory below.')
            setDownloading(false)
        } catch (err: any) {
            if (downloadAttemptRef.current !== attemptId) return
            setStatus('Error: ' + (err.message || 'Unknown error'))
            setDownloading(false)
        }
    }

    const handleCancel = async () => {
        downloadAttemptRef.current++
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
                if (result.version === 'Unsupported') {
                    setShowUnsupported(true)
                }
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
            <div className="pl-1">
                <h2 className="text-2xl font-bold tracking-tight">Game Installation</h2>
                <p className="text-muted-foreground">Manage your Unreal Tournament installation and patches.</p>
            </div>

            <SettingsSection title="Install UT99" icon={Download}>
                <SettingsRow
                    label="Game Installer"
                    description="Don't have Unreal Tournament 1999? Download and install it for free!"
                >
                    {!downloading && !status ? (
                        <Button onClick={handleDownload} disabled={downloading}>
                            Download & Install UT99
                        </Button>
                    ) : (
                        !downloading && status && (
                            <Button onClick={handleDownload} variant="outline" size="sm">
                                Install Again
                            </Button>
                        )
                    )}
                </SettingsRow>

                {(downloading || status) && (downloading || (!downloading && status && status !== 'Installation complete. Please select the installation directory below.')) && (
                    <div className="px-6 pb-6 pt-2 space-y-2">
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
                                <div className="flex justify-end pt-2">
                                    <Button variant="destructive" size="sm" onClick={handleCancel}>
                                        Cancel
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </SettingsSection>

            <SettingsSection title="Installation Directory" icon={Folder}>
                <SettingsRow
                    label="Path"
                    description="Select the directory where Unreal Tournament is installed."
                >
                    <div className="flex gap-2 w-full max-w-md">
                        <Input
                            value={installPath}
                            readOnly
                            placeholder="No directory selected"
                            className="flex-1"
                        />
                        <Button onClick={handleBrowse} variant="secondary">
                            Browse
                        </Button>
                    </div>
                </SettingsRow>
                {isInstallingAnnouncer && (
                    <div className="px-6 pb-6 pt-2 space-y-2 border-t border-border/50">
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
            </SettingsSection>

            <SettingsSection title="Available Patches" icon={Package}>
                {patchVersion === 'Unsupported' && (
                    <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive text-sm border-b border-border/50">
                        <AlertTriangle className="size-5 shrink-0" />
                        <p>
                            You are running an unsupported version of Unreal Tournament.
                            <br />
                            Please apply a patch below to use the launcher.
                        </p>
                    </div>
                )}

                <div className="p-4 text-sm text-muted-foreground border-b border-border/50 bg-muted/20">
                    Select the version of the game that you would like to play on.<br />Installing and changing patches has <span className="italic">no</span> effect on your graphics settings, keybinds, and only changes the game engine.<br /><br /><b>Patching is completely safe!</b>
                </div>

                {patches.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">Loading patches...</div>
                ) : (
                    patches.map((patch) => {
                        const isInstalled = patchVersion === patch.tag
                        const isInstalling = installingPatch === patch.tag

                        return (
                            <SettingsRow
                                key={patch.tag}
                                label={
                                    <div className="flex items-center gap-2">
                                        {patch.tag}
                                        {isInstalled && !isInstalling && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase font-bold tracking-wider">Installed</span>
                                        )}
                                    </div>
                                }
                                description={
                                    <div className="flex flex-col gap-1">
                                        <a
                                            href={patch.release_notes_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-primary hover:underline w-fit"
                                        >
                                            View Release Notes
                                        </a>
                                        {isInstalling && (
                                            <div className="space-y-1 mt-1 w-full max-w-[200px]">
                                                <div className="flex justify-between text-[10px] text-muted-foreground">
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
                                }
                            >
                                <Button
                                    size="sm"
                                    onClick={() => handleInstallPatch(patch)}
                                    disabled={isInstalling || !installPath}
                                    variant={isInstalled ? 'outline' : 'default'}
                                >
                                    {isInstalling ? 'Installing...' : isInstalled ? 'Reinstall' : 'Install'}
                                </Button>
                            </SettingsRow>
                        )
                    })
                )}
            </SettingsSection>


            <ErrorModal
                isOpen={showError}
                onClose={() => setShowError(false)}
                title="Installation Directory Error"
                message={errorMessage}
            />

            <ErrorModal
                isOpen={showUnsupported}
                onClose={() => setShowUnsupported(false)}
                title="Unsupported Game Version"
                message="UTBT servers require players to be on supported versions of the 469 patch. Please use the Patch Installer to install a newer patch to be able to play."
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
        </div >
    )
}
