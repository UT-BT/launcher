import { useState, useEffect } from 'react'
import { Video, ChevronDown, AlertTriangle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from '@/app/components/ui/dropdown-menu'

export function LauncherDemoSettings() {
    const [autoDemoRec, setAutoDemoRec] = useState(false)
    const [autoDemoUpload, setAutoDemoUpload] = useState('Never')
    const [demoPostAction, setDemoPostAction] = useState('Do Nothing')
    const [discardedDemoAction, setDiscardedDemoAction] = useState('Do Nothing')
    const [utPathExists, setUtPathExists] = useState(false)
    const [patchVersion, setPatchVersion] = useState('')

    useEffect(() => {
        const loadSettings = async () => {
            let installPath: string | undefined
            try {
                installPath = await window.conveyor.app.getUt99InstallPath()
                setUtPathExists(!!installPath)
            } catch (error) {
                window.logging.warn('Failed to load UT99 install path', 'LauncherDemoSettings', String(error))
            }

            try {
                const demoConfig = await window.conveyor.app.getDemoWatcherConfig()
                if (demoConfig) {
                    setAutoDemoUpload(demoConfig.autoUpload)
                    setDemoPostAction(demoConfig.postUploadAction)
                    setDiscardedDemoAction(demoConfig.discardDemoAction || 'Do Nothing')
                }
            } catch (error) {
                window.logging.warn('Failed to load demo watcher config', 'LauncherDemoSettings', String(error))
            }

            try {
                const patch = await window.conveyor.app.getInstalledPatch()
                setPatchVersion(patch?.tag || 'Unknown')
            } catch (error) {
                window.logging.warn('Failed to load installed patch', 'LauncherDemoSettings', String(error))
            }

            if (!installPath) return

            try {
                const val = await window.conveyor.ini.readIniValue('UTBT_UserSettings.ini', 'UserSettings', 'AutoDemoRec')
                setAutoDemoRec(val?.toLowerCase() === 'true')
            } catch (error) {
                window.logging.warn('Failed to read AutoDemoRec setting', 'LauncherDemoSettings', String(error))
            }
        }
        loadSettings()
    }, [])

    const saveDemoConfig = async (uploadVal: string, actionVal: string, discardVal: string) => {
        await window.conveyor.app.setDemoWatcherConfig({
            autoUpload: uploadVal as any,
            postUploadAction: actionVal as any,
            discardDemoAction: discardVal as any
        })
    }

    const handleAutoDemoUploadChange = (val: string) => {
        setAutoDemoUpload(val)
        saveDemoConfig(val, demoPostAction, discardedDemoAction)
    }

    const handleDemoPostActionChange = (val: string) => {
        setDemoPostAction(val)
        saveDemoConfig(autoDemoUpload, val, discardedDemoAction)
    }

    const handleDiscardedDemoActionChange = (val: string) => {
        setDiscardedDemoAction(val)
        saveDemoConfig(autoDemoUpload, demoPostAction, val)
    }

    const disabled = !utPathExists || patchVersion === 'Unsupported'

    return (
        <div className="space-y-6">
            <div className="pl-1">
                <h2 className="text-2xl font-bold tracking-tight">Demo Recording</h2>
                <p className="text-muted-foreground">Configure automatic demo recording and uploading.</p>
            </div>

            <SettingsSection title="Auto Demo Recording & Uploading" icon={Video}>
                {patchVersion === 'Unsupported' && (
                    <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive text-sm border-b border-border/50">
                        <AlertTriangle className="size-5 shrink-0" />
                        <p>
                            You are running an unsupported version of Unreal Tournament.
                            <br />
                            Please apply a patch in the Game Installation settings to use these features.
                        </p>
                    </div>
                )}

                <SettingsRow
                    label="Auto Demo Recording"
                    description="Automatically record demos of your caps when you play on UTBT servers."
                >
                    <Switch
                        checked={autoDemoRec}
                        onCheckedChange={(checked) => {
                            setAutoDemoRec(checked)
                            if (utPathExists) {
                                window.conveyor.ini.writeIniValue('UTBT_UserSettings.ini', 'UserSettings', 'AutoDemoRec', checked ? 'True' : 'False', true)
                            }
                        }}
                        disabled={disabled}
                    />
                </SettingsRow>

                <SettingsRow
                    label="Auto Demo Upload"
                    description={
                        <div className="flex flex-col gap-1">
                            <span>Choose when to automatically upload solo demos.</span>
                            {autoDemoUpload !== 'Never' && (
                                <span className="text-xs text-muted-foreground">
                                    Certified team demos always upload for team verification, regardless of the solo PB/WR filter.
                                </span>
                            )}
                            {autoDemoUpload === 'Never' && (
                                <span className="flex items-center gap-1 text-yellow-500 text-xs font-semibold">
                                    <AlertTriangle className="size-3" />
                                    Team runs remain pending without automatic uploads
                                </span>
                            )}
                        </div>
                    }
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={disabled}>
                            <Button variant="outline" className="w-[200px] justify-between font-normal">
                                {autoDemoUpload}
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px]" align="end">
                            <DropdownMenuRadioGroup value={autoDemoUpload} onValueChange={handleAutoDemoUploadChange}>
                                <DropdownMenuRadioItem value="Never">Never</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="World Records Only">World Records Only</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Personal Bests Only">Personal Bests Only</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SettingsRow>

                <SettingsRow
                    label="Discarded Demos"
                    description="Choose what to do with solo demos that aren't personal bests or world records. Pending team evidence is never discarded."
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={disabled || autoDemoUpload === 'Never'}>
                            <Button variant="outline" className={`w-[200px] justify-between font-normal ${disabled || autoDemoUpload === 'Never' ? 'opacity-50' : ''}`}>
                                {discardedDemoAction === 'Move to Folder' ? "Move to 'Discarded' Folder" : discardedDemoAction}
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px]" align="end">
                            <DropdownMenuRadioGroup value={discardedDemoAction} onValueChange={handleDiscardedDemoActionChange}>
                                <DropdownMenuRadioItem value="Do Nothing">Do Nothing</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Move to Folder">Move to 'Discarded' Folder</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Delete">Delete</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SettingsRow>

                <SettingsRow
                    label="After Upload Action"
                    description="After a successful upload, move, delete, or retain the demo. Failed uploads retry for up to 24 hours and leave the source untouched."
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={disabled || autoDemoUpload === 'Never'}>
                            <Button variant="outline" className={`w-[200px] justify-between font-normal ${disabled || autoDemoUpload === 'Never' ? 'opacity-50' : ''}`}>
                                {demoPostAction === 'Move to Folder' ? "Move to 'Uploaded' Folder" : demoPostAction}
                                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px]" align="end">
                            <DropdownMenuRadioGroup value={demoPostAction} onValueChange={handleDemoPostActionChange}>
                                <DropdownMenuRadioItem value="Do Nothing">Do Nothing</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Move to Folder">Move to 'Uploaded' Folder</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Delete">Delete</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SettingsRow>
            </SettingsSection>
        </div>
    )
}
