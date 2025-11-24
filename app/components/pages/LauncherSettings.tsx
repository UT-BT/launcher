import { useState, useEffect } from 'react'
import { ArrowLeft, Laptop } from 'lucide-react'
import { Slider } from '@/app/components/ui/slider'
import { Button } from '@/app/components/ui/button'

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
        </div>
    )
}
