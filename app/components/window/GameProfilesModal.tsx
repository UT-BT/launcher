import { useEffect, useState } from 'react'
import { FaTimes, FaSave, FaTrash, FaExchangeAlt, FaPlus, FaEdit, FaCheck } from 'react-icons/fa'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { ConfirmModal } from '@/app/components/shared/ConfirmModal'
import { cn } from '@/lib/utils'

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

    const fetchProfiles = async () => {
        try {
            const list = await window.conveyor.app.getProfiles()
            setProfiles(list)

            const active = await window.conveyor.app.getActiveProfile()
            setActiveProfileName(active ?? null)

            if (list.length > 0 && !selectedProfile) {
                setSelectedProfile(active || list[0].name)
            }
        } catch (error) {
            console.error('Failed to fetch profiles:', error)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchProfiles()
        }
    }, [isOpen])

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return
        setIsSaving(true)
        try {
            const path = await window.conveyor.app.getUt99InstallPath()
            if (path) {
                await window.conveyor.app.createProfile(newProfileName.trim(), path)
                setNewProfileName('')
                await fetchProfiles()
            }
        } catch (error) {
            console.error('Failed to create profile:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleOverwriteProfile = (name: string) => {
        setProfileToOverwrite(name)
        setShowOverwriteConfirm(true)
    }

    const handleOverwriteConfirm = async () => {
        if (!profileToOverwrite) return
        setIsSaving(true)
        try {
            const path = await window.conveyor.app.getUt99InstallPath()
            if (path) {
                await window.conveyor.app.createProfile(profileToOverwrite, path)
                setShowOverwriteConfirm(false)
                setProfileToOverwrite(null)
                await fetchProfiles()
            }
        } catch (error) {
            console.error('Failed to overwrite profile:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleSwitchProfile = async (name: string) => {
        try {
            await window.conveyor.app.switchProfile(name)
            onClose()
        } catch (error) {
            console.error('Failed to switch profile:', error)
        }
    }

    const handleDeleteProfile = async () => {
        if (!profileToDelete) return
        try {
            await window.conveyor.app.deleteProfile(profileToDelete)
            setProfileToDelete(null)
            setShowDeleteConfirm(false)
            await fetchProfiles()
        } catch (error) {
            console.error('Failed to delete profile:', error)
        }
    }

    const handleRenameProfile = async (oldName: string) => {
        if (!renameName.trim() || renameName === oldName) {
            setRenamingProfile(null)
            return
        }
        try {
            await window.conveyor.app.renameProfile(oldName, renameName.trim())
            setRenamingProfile(null)
            setRenameName('')
            await fetchProfiles()
        } catch (error) {
            console.error('Failed to rename profile:', error)
        }
    }

    const startRenaming = (profile: string) => {
        setRenamingProfile(profile)
        setRenameName(profile)
    }

    if (!isOpen) return null

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            Game Profiles
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <FaTimes />
                        </button>
                    </div>

                    <div className="p-4 bg-muted/30 border-b border-border text-xs text-muted-foreground space-y-2">
                        <p>
                            Profiles give you the ability save your current graphics settings and binds.
                            Here you can create, switch, overwrite and delete these profiles as you wish.
                        </p>
                        <p>
                            The <span className="italic text-foreground">Default</span> profile was created from your original installation.
                        </p>
                    </div>

                    <div className="p-4 border-b border-border space-y-4">
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
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                                        activeProfile === profile.name ? "bg-primary/10 border-primary/50" : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        {renamingProfile === profile.name ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    value={renameName}
                                                    onChange={(e) => setRenameName(e.target.value)}
                                                    size="sm"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameProfile(profile.name)
                                                        if (e.key === 'Escape') setRenamingProfile(null)
                                                    }}
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
                                                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Active</span>
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
                                        >
                                            <FaSave />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => startRenaming(profile.name)}
                                            title="Rename Profile"
                                            disabled={profile.name === 'Default' || profile.name.startsWith('Default (')}
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
                                            disabled={profile.name === 'Default' || profile.name.startsWith('Default (')}
                                        >
                                            <FaTrash />
                                        </Button>
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
        </>
    )
}
