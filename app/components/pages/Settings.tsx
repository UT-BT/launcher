import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Joystick } from 'lucide-react'
import { LauncherSettings } from './LauncherSettings'
import { UnrealTournamentSettings } from './UnrealTournamentSettings'

type SettingsView = 'main' | 'launcher' | 'game'

export function Settings() {
    const [view, setView] = useState<SettingsView>('main')
    const [launcherVersion, setLauncherVersion] = useState('')
    const [utVersion, setUtVersion] = useState('')

    useEffect(() => {
        window.conveyor.app.version().then(setLauncherVersion)
        window.conveyor.app.getInstalledPatch().then((patch) => {
            setUtVersion(patch?.tag || 'Unknown')
        })
    }, [])

    if (view === 'launcher') {
        return <LauncherSettings onBack={() => setView('main')} />
    }

    if (view === 'game') {
        return <UnrealTournamentSettings onBack={() => setView('main')} />
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div
                    onClick={() => setView('launcher')}
                    className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-lg bg-gray-500/10 text-gray-500 group-hover:bg-gray-500/20 transition-colors">
                            <SettingsIcon className="size-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">General</h3>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => setView('game')}
                    className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-lg bg-red-500/10 text-red-500 group-hover:bg-red-500/20 transition-colors">
                            <Joystick className="size-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Game</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border flex justify-between text-xs text-muted-foreground">
                <span>Launcher Version: {launcherVersion}</span>
                <span>UT Version: {utVersion}</span>
            </div>
        </div>
    )
}
