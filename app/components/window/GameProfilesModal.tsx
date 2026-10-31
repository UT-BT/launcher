import { useEffect, useState, useCallback } from 'react'
import { FaSave, FaTrash, FaExchangeAlt, FaPlus, FaEdit, FaCheck } from 'react-icons/fa'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Modal } from '@/app/components/ui/modal'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { cn } from '@/lib/utils'
import { runProfileAction } from './profileAction'

interface ProfileMetadata {
    name: string
    modifiedAt: string
}

interface GameProfilesModalProps {
    isOpen: boolean
    onClose: () => void
}

export const GameProfilesModal = ({ isOpen, onClose }: GameProfilesModalProps) => {
    const [profiles, setProfiles] = useState<ProfileMetadata[]>([])
    const [activeProfile, setActiveProfileName] = useState<string | null>(null)
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
    const [newProfileName, setNewProfileName] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null)
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
    const [profileToOverwrite, setProfileToOverwrite] = useState<string | null>(null)
    const [renamingProfile, setRenamingProfile] = useState<string | null>(null)
    const [renameName, setRenameName] = useState('')
    const [isActiveDirty, setIsActiveDirty] = useState(false)
    const [pendingSwitchProfile, setPendingSwitchProfile] = useState<string | null>(null)
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
    const [profileError, setProfileError] = useState<string | null>(null)

    const fetchProfiles = useCallback(async () => {
        try {
            const list = await window.conveyor.app.getProfiles()
            const sortedList = list.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
            setProfiles(sortedList)

            const active = await window.conveyor.app.getActiveProfile()
            setActiveProfileName(active ?? null)

            if (sortedList.length > 0 && !selectedProfile) {
                setSelectedProfile(active || sortedList[0].name)
            }

            if (active) {
                const isDirty = await window.conveyor.app.checkProfileSync(active)
                setIsActiveDirty(isDirty)
            } else {
                setIsActiveDirty(false)
            }
        } catch (error) {
            console.error('Failed to fetch profiles:', error)
        }
    }, [selectedProfile])

    useEffect(() => {
        if (isOpen) {
            setProfileError(null)
            fetchProfiles()
        }
    }, [isOpen, fetchProfiles])

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return
        setIsSaving(true)
        const error = await runProfileAction(async () => {
            const path = await window.conveyor.app.getUt99InstallPath()
            if (path) {
                await window.conveyor.app.createProfile(newProfileName.trim(), path)
                setNewProfileName('')
                await fetchProfiles()
            }
        })
        setProfileError(error)
        setIsSaving(false)
    }

    const handleOverwriteProfile = (name: string) => {
        setProfileToOverwrite(name)
        setShowOverwriteConfirm(true)
    }

    const handleOverwriteConfirm = async () => {
        if (!profileToOverwrite) return
        setIsSaving(true)
        const error = await runProfileAction(async () => {
            const path = await window.conveyor.app.getUt99InstallPath()
            if (path) {
                await window.conveyor.app.createProfile(profileToOverwrite, path)
                await fetchProfiles()
            }
        })
        setShowOverwriteConfirm(false)
        setProfileToOverwrite(null)
        setProfileError(error)
        setIsSaving(false)
    }

    const handleSwitchProfile = async (name: string) => {
        if (isActiveDirty && name !== activeProfile) {
            setPendingSwitchProfile(name)
            setShowDiscardConfirm(true)
            return
        }
        await performSwitch(name)
    }

    const performSwitch = async (name: string) => {
        const error = await runProfileAction(() => window.conveyor.app.switchProfile(name))
        setShowDiscardConfirm(false)
        setPendingSwitchProfile(null)
        setProfileError(error)
        if (!error) onClose()
    }

    const handleDeleteProfile = async () => {
        if (!profileToDelete) return
        const error = await runProfileAction(() => window.conveyor.app.deleteProfile(profileToDelete))
        setProfileToDelete(null)
        setShowDeleteConfirm(false)
        setProfileError(error)
        if (!error) await fetchProfiles()
    }

    const handleRenameProfile = async (oldName: string) => {
        if (!renameName.trim() || renameName === oldName) {
            setRenamingProfile(null)
            return
        }
        const error = await runProfileAction(() => window.conveyor.app.renameProfile(oldName, renameName.trim()))
        setProfileError(error)
        if (error) return
        setRenamingProfile(null)
        setRenameName('')
        await fetchProfiles()
    }

    const startRenaming = (profile: string) => {
        setRenamingProfile(profile)
        setRenameName(profile)
    }

    const dismiss = () => {
        if (showDeleteConfirm || showOverwriteConfirm || showDiscardConfirm) {
            setShowDeleteConfirm(false)
            setShowOverwriteConfirm(false)
            setShowDiscardConfirm(false)
            return
        }
        if (renamingProfile) {
            setRenamingProfile(null)
            return
        }
        onClose()
    }

    if (!isOpen) return null

    return (
        <>
            <Modal
                isOpen
                onClose={dismiss}
                title="Game Profiles"
                maxWidth="42rem"
                maxHeight="80vh"
                offsetSidebar
            >
                <div className="space-y-4">
                    <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs text-muted-foreground space-y-2">
                        <p>
                            Profiles give you the ability save your current graphics settings and binds.
                            Here you can create, switch, overwrite and delete these profiles as you wish.
                        </p>
                        <p>
                            The <span className="italic text-foreground">Original</span> profile is a permanent backup of your game's first-seen settings and cannot be edited.
                        </p>
                        <p>
                            If you ever need to restore your original settings, you can switch to this profile.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Backup current settings as..."
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                className="flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                            />
                            <Button onClick={handleCreateProfile} disabled={!newProfileName.trim() || isSaving}>
                                <FaPlus className="mr-2" /> Save New
                            </Button>
                        </div>
                        {profileError && (
                            <p role="alert" className="text-xs text-red-300 break-words">{profileError}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        {profiles.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                No profiles found.
                            </div>
                        ) : (
                            profiles.map((profile) => (
                                <div
                                    key={profile.name}
                                    className={cn(
                                        "flex items-center gap-4 p-3 rounded-lg border transition-colors",
                                        activeProfile === profile.name ? "bg-primary/10 border-primary/50" : "bg-hairline/5 border-hairline/5 hover:bg-hairline/10"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        {renamingProfile === profile.name ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    value={renameName}
                                                    onChange={(e) => setRenameName(e.target.value)}
                                                    className="h-8"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameProfile(profile.name)}
                                                />
                                                <Button size="sm" onClick={() => handleRenameProfile(profile.name)}>
                                                    <FaCheck />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-sm font-medium truncate">{profile.name}</div>
                                                    {activeProfile === profile.name && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Active</span>
                                                            {isActiveDirty && (
                                                                <span
                                                                    className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-medium border border-yellow-500/30 animate-pulse"
                                                                    title="You have changes in the game folder that are not saved to this profile."
                                                                >
                                                                    <div className="size-1.5 rounded-full bg-yellow-500" />
                                                                    Unsaved Changes
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Last Saved: {new Date(profile.modifiedAt).toLocaleString()}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleSwitchProfile(profile.name)}
                                            title="Load Profile"
                                        >
                                            <FaExchangeAlt />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleOverwriteProfile(profile.name)}
                                            title="Overwrite with Current"
                                            disabled={profile.name === 'Original' || profile.name.startsWith('Original (')}
                                        >
                                            <FaSave />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => startRenaming(profile.name)}
                                            title="Rename Profile"
                                            disabled={profile.name === 'Original' || profile.name.startsWith('Original (')}
                                        >
                                            <FaEdit />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                            onClick={() => {
                                                setProfileToDelete(profile.name)
                                                setShowDeleteConfirm(true)
                                            }}
                                            title="Delete Profile"
                                            disabled={profile.name === 'Original' || profile.name.startsWith('Original (')}
                                        >
                                            <FaTrash />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteProfile}
                title="Delete Profile"
                message={`Are you sure you want to delete the profile "${profileToDelete}"?`}
                confirmText="Delete"
                variant="error"
            />

            <ConfirmModal
                isOpen={showOverwriteConfirm}
                onClose={() => setShowOverwriteConfirm(false)}
                onConfirm={handleOverwriteConfirm}
                title="Overwrite Profile"
                message={`Are you sure you want to overwrite the profile "${profileToOverwrite}" with your current settings?`}
                confirmText="Overwrite"
                variant="default"
            />

            <ConfirmModal
                isOpen={showDiscardConfirm}
                onClose={() => setShowDiscardConfirm(false)}
                onConfirm={() => pendingSwitchProfile && performSwitch(pendingSwitchProfile)}
                title="Discard Changes?"
                message={`You have unsaved changes in your active profile. Switching to "${pendingSwitchProfile}" will discard these changes. Are you sure?`}
                confirmText="Discard & Switch"
                variant="error"
            />
        </>
    )
}
