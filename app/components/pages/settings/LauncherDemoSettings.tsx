import { useState, useEffect } from 'react'
import { Video, ChevronDown, AlertTriangle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
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
    const [utPathExists, setUtPathExists] = useState(false)
    const [patchVersion, setPatchVersion] = useState('')

    useEffect(() => {
        const loadSettings = async () => {
            const installPath = await window.conveyor.app.getUt99InstallPath()
            setUtPathExists(!!installPath)

            const demoConfig = await window.conveyor.app.getDemoWatcherConfig()
            if (demoConfig) {
                setAutoDemoUpload(demoConfig.autoUpload)
                setDemoPostAction(demoConfig.postUploadAction)
            }

            const patch = await window.conveyor.app.getInstalledPatch()
            setPatchVersion(patch?.tag || 'Unknown')

            if (!installPath) return

            const val = await window.conveyor.ini.readIniValue('UTBT_UserSettings.ini', 'UserSettings', 'AutoDemoRec')
            setAutoDemoRec(val?.toLowerCase() === 'true')
        }
        loadSettings()
    }, [])

    const handleAutoDemoRecChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.checked
        setAutoDemoRec(newValue)
        if (utPathExists) {
            await window.conveyor.ini.writeIniValue('UTBT_UserSettings.ini', 'UserSettings', 'AutoDemoRec', newValue ? 'True' : 'False', true)
        }
    }

    const saveDemoConfig = async (uploadVal: string, actionVal: string) => {
        await window.conveyor.app.setDemoWatcherConfig({
            autoUpload: uploadVal as any,
            postUploadAction: actionVal as any
        })
    }

    const handleAutoDemoUploadChange = (val: string) => {
        setAutoDemoUpload(val)
        saveDemoConfig(val, demoPostAction)
    }

    const handleDemoPostActionChange = (val: string) => {
        setDemoPostAction(val)
        saveDemoConfig(autoDemoUpload, val)
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
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoDemoRec}
                            onChange={handleAutoDemoRecChange}
                            disabled={disabled}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary opacity-100 peer-disabled:opacity-50"></div>
                    </label>
                </SettingsRow>

                <SettingsRow
                    label="Auto Demo Upload"
                    description={
                        <div className="flex flex-col gap-1">
                            <span>Choose when to automatically upload recorded demos.</span>
                            {autoDemoUpload === 'Never' && (
                                <span className="flex items-center gap-1 text-yellow-500 text-xs font-semibold">
                                    <AlertTriangle className="size-3" />
                                    Required for verification (24h limit)
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
                                <DropdownMenuRadioItem value="All Runs">All Runs</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </SettingsRow>

                <SettingsRow
                    label="After Upload Action"
                    description="Choose what to do with the demo file after it has been processed."
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
