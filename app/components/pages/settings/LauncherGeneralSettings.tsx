import { useState, useEffect } from 'react'
import { Laptop, Download } from 'lucide-react'
import { Slider } from '@/app/components/ui/slider'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import { useUpdater } from '@/app/hooks/useUpdater'

export function LauncherGeneralSettings() {
    const [uiScale, setUiScale] = useState(100)
    const { state, check, download, install, setAllowPrerelease } = useUpdater()

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
        document.documentElement.style.setProperty('--app-scale', (uiScale / 100).toString())
        localStorage.setItem('ui-scale', uiScale.toString())
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
                    <div className="flex items-center gap-4 w-48">
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
