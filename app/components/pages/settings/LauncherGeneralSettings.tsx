import { useState, useEffect } from 'react'
import { Laptop } from 'lucide-react'
import { Slider } from '@/app/components/ui/slider'
import { SettingsSection, SettingsRow } from './SettingsComponents'

export function LauncherGeneralSettings() {
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
        </div>
    )
}
