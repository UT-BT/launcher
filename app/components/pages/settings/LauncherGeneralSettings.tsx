import { useState, useEffect } from 'react'
import { Laptop, Download, AppWindow } from 'lucide-react'
import { Slider } from '@/app/components/ui/slider'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import { useUpdater } from '@/app/hooks/useUpdater'

type MinimizeAction = 'taskbar' | 'tray'
type CloseAction = 'quit' | 'tray'

const selectClass = "flex h-9 w-full @md/panel:w-[220px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

export function LauncherGeneralSettings() {
    const [uiScale, setUiScale] = useState(100)
    const { state, check, download, install, setAllowPrerelease } = useUpdater()

    const [minimizeAction, setMinimizeAction] = useState<MinimizeAction>('taskbar')
    const [closeAction, setCloseAction] = useState<CloseAction>('quit')
    const [startOnStartup, setStartOnStartup] = useState(false)
    const [startMinimized, setStartMinimized] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('ui-scale')
        if (saved) {
            setUiScale(parseInt(saved, 10))
        }
    }, [])

    useEffect(() => {
        const loadWindowBehavior = async () => {
            const behavior = await window.conveyor.app.getWindowBehavior()
            if (behavior) {
                setMinimizeAction(behavior.minimizeAction)
                setCloseAction(behavior.closeAction)
                setStartOnStartup(behavior.startOnStartup)
                setStartMinimized(behavior.startMinimized)
            }
        }
        void loadWindowBehavior()
    }, [])

    const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUiScale(parseInt(e.target.value, 10))
    }

    const handleScaleCommit = () => {
        window.uiScale?.set(uiScale / 100)
        localStorage.setItem('ui-scale', uiScale.toString())
    }

    const saveWindowBehavior = (next: {
        minimizeAction: MinimizeAction
        closeAction: CloseAction
        startOnStartup: boolean
        startMinimized: boolean
    }) => {
        void window.conveyor.app.setWindowBehavior(next)
    }

    const handleMinimizeActionChange = (value: MinimizeAction) => {
        setMinimizeAction(value)
        saveWindowBehavior({ minimizeAction: value, closeAction, startOnStartup, startMinimized })
    }

    const handleCloseActionChange = (value: CloseAction) => {
        setCloseAction(value)
        saveWindowBehavior({ minimizeAction, closeAction: value, startOnStartup, startMinimized })
    }

    const handleStartOnStartupChange = (value: boolean) => {
        setStartOnStartup(value)
        saveWindowBehavior({ minimizeAction, closeAction, startOnStartup: value, startMinimized })
    }

    const handleStartMinimizedChange = (value: boolean) => {
        setStartMinimized(value)
        saveWindowBehavior({ minimizeAction, closeAction, startOnStartup, startMinimized: value })
    }

    const updateStatus = (() => {
        switch (state.phase) {
            case 'checking':
                return 'Checking…'
            case 'available':
                return `Update available — v${state.version}`
            case 'downloading':
                return `Downloading… ${Math.round(state.progressPercent ?? 0)}%`
            case 'downloaded':
                return `Update ready — v${state.version}. Restart to install.`
            case 'installing':
                return 'Installing…'
            case 'not-available':
                return `Up to date (v${state.currentVersion})`
            case 'error':
                return state.error ? `Error: ${state.error}` : 'Update check failed.'
            default:
                return `v${state.currentVersion}`
        }
    })()

    const isBusy = state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'installing'

    const updateAction = (() => {
        if (state.phase === 'available') {
            return { label: `Download v${state.version}`, run: () => { void download() } }
        }
        if (state.phase === 'downloaded') {
            return { label: 'Restart & install', run: () => { void install() } }
        }
        return { label: state.phase === 'checking' ? 'Checking…' : 'Check for updates', run: () => { void check(true) } }
    })()

    return (
        <div className="space-y-6">
            <div className="pl-1">
                <h2 className="text-2xl font-bold tracking-tight">General Launcher Settings</h2>
                <p className="text-muted-foreground">Customize your launcher experience.</p>
            </div>

            <SettingsSection title="User Interface" icon={Laptop}>
                <SettingsRow
                    label="Scale"
                    description={`Adjust the scale of the user interface.`}
                >
                    <div className="flex items-center gap-4 w-full @md/panel:w-48">
                        <span className="text-xs font-mono w-8">{uiScale}%</span>
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
                            className="flex-1"
                        />
                    </div>
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="System" icon={AppWindow}>
                <SettingsRow
                    label="Minimizing"
                    description="Choose what happens when you minimize the launcher."
                >
                    <select
                        style={{ colorScheme: 'dark' }}
                        className={selectClass}
                        value={minimizeAction}
                        onChange={(e) => handleMinimizeActionChange(e.target.value as MinimizeAction)}
                    >
                        <option value="taskbar">Minimize to taskbar</option>
                        <option value="tray">Minimize to system tray</option>
                    </select>
                </SettingsRow>
                <SettingsRow
                    label="Exiting"
                    description="Choose what happens when you close the launcher."
                >
                    <select
                        style={{ colorScheme: 'dark' }}
                        className={selectClass}
                        value={closeAction}
                        onChange={(e) => handleCloseActionChange(e.target.value as CloseAction)}
                    >
                        <option value="quit">Quit the launcher</option>
                        <option value="tray">Minimize to system tray</option>
                    </select>
                </SettingsRow>
                <SettingsRow
                    label="Start on system startup"
                    description="Automatically launch UTBT when you sign in to Windows."
                >
                    <Switch
                        checked={startOnStartup}
                        onCheckedChange={handleStartOnStartupChange}
                    />
                </SettingsRow>
                <SettingsRow
                    label="Start minimized to tray"
                    description="When launching at startup, start hidden in the system tray instead of opening the window."
                >
                    <Switch
                        checked={startMinimized}
                        disabled={!startOnStartup}
                        onCheckedChange={handleStartMinimizedChange}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Updates" icon={Download}>
                <SettingsRow
                    label="Launcher version"
                    description={updateStatus}
                >
                    <Button
                        variant={state.phase === 'available' || state.phase === 'downloaded' ? 'default' : 'secondary'}
                        onClick={updateAction.run}
                        disabled={isBusy}
                    >
                        {updateAction.label}
                    </Button>
                </SettingsRow>
                <SettingsRow
                    label="Include release candidates"
                    description="Opt in to early-access RC builds. RC versions may be unstable; disable to stay on stable releases only."
                >
                    <Switch
                        checked={state.allowPrerelease}
                        onCheckedChange={(v) => { void setAllowPrerelease(v) }}
                    />
                </SettingsRow>
            </SettingsSection>
        </div>
    )
}
