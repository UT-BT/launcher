import { useState, useEffect } from 'react'
import { ArrowLeft, Laptop, Video, ChevronDown, AlertTriangle } from 'lucide-react'
import { Slider } from '@/app/components/ui/slider'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from '@/app/components/ui/dropdown-menu'

interface LauncherSettingsProps {
    onBack: () => void
}

export function LauncherSettings({ onBack }: LauncherSettingsProps) {
    const [uiScale, setUiScale] = useState(100)

    useEffect(() => {
        const saved = localStorage.getItem('ui-scale')
        if (saved) {
            setUiScale(parseInt(saved, 10))
        }
    }, [])

    const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUiScale(parseInt(e.target.value, 10))
    }

    const handleScaleCommit = () => {
        document.documentElement.style.zoom = `${uiScale}%`
        localStorage.setItem('ui-scale', uiScale.toString())
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="size-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">UTBT Launcher Settings</h2>
                </div>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-gray-500/10 text-gray-500">
                        <Laptop className="size-6" />
                    </div>
                    <h3 className="text-lg font-semibold">User Interface</h3>
                </div>

                <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm font-medium">Scale</label>
                            <span className="text-sm text-muted-foreground">{uiScale}%</span>
                        </div>
                        <Slider
                            min={75}
                            max={150}
                            step={5}
                            value={uiScale}
                            onChange={handleScaleChange}
                            onMouseUp={handleScaleCommit}
                            onTouchEnd={handleScaleCommit}
                            onKeyUp={(e) => {
                                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                    handleScaleCommit()
                                }
                            }}
                        />
                        <p className="text-xs text-muted-foreground">Adjust the scale of the user interface.</p>
                    </div>
                </div>
            </div>

            <DemoRecordingSettings />
        </div>
    )
}

function DemoRecordingSettings() {
    const [autoDemoRec, setAutoDemoRec] = useState(false)
    const [autoDemoUpload, setAutoDemoUpload] = useState('Never')
    const [demoPostAction, setDemoPostAction] = useState('Do Nothing')
    const [utPathExists, setUtPathExists] = useState(false)

    useEffect(() => {
        const loadSettings = async () => {
            const installPath = await window.conveyor.app.getUt99InstallPath()
            setUtPathExists(!!installPath)

            const demoConfig = await window.conveyor.app.getDemoWatcherConfig()
            if (demoConfig) {
                setAutoDemoUpload(demoConfig.autoUpload)
                setDemoPostAction(demoConfig.postUploadAction)
            }

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

    const disabled = !utPathExists

    return (
        <div className="p-6 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
                    <Video className="size-6" />
                </div>
                <h3 className="text-lg font-semibold">Auto Demo Recording & Uploading</h3>
            </div>

            <div className="space-y-6 max-w-md">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="autoDemoRec"
                            checked={autoDemoRec}
                            onChange={handleAutoDemoRecChange}
                            disabled={disabled}
                            className="mt-1 size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-background/50 accent-blue-600"
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="autoDemoRec"
                                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${disabled ? 'opacity-50' : ''}`}
                            >
                                Auto Demo Recording
                            </label>
                            <p className={`text-xs text-muted-foreground ${disabled ? 'opacity-50' : ''}`}>
                                Automatically record demos of your caps when you play on UTBT servers.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label
                                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${disabled ? 'opacity-50' : ''}`}
                            >
                                Auto Demo Upload
                            </label>
                            <Tooltip content="Only caps that have been done on UTBT Certified Servers are able to be uploaded" />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={disabled}>
                                <Button variant="outline" className="w-full justify-between font-normal">
                                    {autoDemoUpload}
                                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[448px]" align="start">
                                <DropdownMenuRadioGroup value={autoDemoUpload} onValueChange={handleAutoDemoUploadChange}>
                                    <DropdownMenuRadioItem value="Never">Never</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="World Records Only">World Records Only</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="Personal Bests Only">Personal Bests Only</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="All Runs">All Runs</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <p className={`text-xs text-muted-foreground ${disabled ? 'opacity-50' : ''}`}>
                            Choose when to automatically upload recorded demos.
                        </p>
                        {autoDemoUpload === 'Never' && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-2">
                                <AlertTriangle className="size-4 flex-shrink-0 text-yellow-500 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-yellow-500">UPDATE ON DEMO VERIFICATION</p>
                                    <p className="text-[10px] leading-relaxed text-yellow-500/90">
                                        Demos are expected to be uploaded within <b>24 hours</b> of the cap being set. By disabling auto demo upload, you bare the risk of not having the ability to verify your time.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label
                            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${disabled ? 'opacity-50' : ''}`}
                        >
                            After Upload Action
                        </label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={disabled || autoDemoUpload === 'Never'}>
                                <Button variant="outline" className={`w-full justify-between font-normal ${(disabled || autoDemoUpload === 'Never') ? 'opacity-50' : ''}`}>
                                    {demoPostAction === 'Move to Folder' ? "Move to 'Uploaded' Folder" : demoPostAction}
                                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[448px]" align="start">
                                <DropdownMenuRadioGroup value={demoPostAction} onValueChange={handleDemoPostActionChange}>
                                    <DropdownMenuRadioItem value="Do Nothing">Do Nothing</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="Move to Folder">Move to 'Uploaded' Folder</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="Delete">Delete</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <p className={`text-xs text-muted-foreground ${disabled ? 'opacity-50' : ''}`}>
                            Choose what to do with the demo file after it has been processed.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
