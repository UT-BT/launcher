import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Joystick, HardDrive } from 'lucide-react'
import { LauncherSettings } from './LauncherSettings'
import { UnrealTournamentSettings } from './UnrealTournamentSettings'
import { GameInstallationSettings } from './GameInstallationSettings'
import { ErrorModal } from '../ErrorModal'

type SettingsView = 'main' | 'launcher' | 'game' | 'installation'

interface SettingsProps {
    initialSection?: 'game-installation'
}

export function Settings({ initialSection }: SettingsProps = {}) {
    const [view, setView] = useState<SettingsView>(
        initialSection === 'game-installation' ? 'installation' : 'main'
    )
    const [launcherVersion, setLauncherVersion] = useState('')
    const [utVersion, setUtVersion] = useState('')
    const [showErrorModal, setShowErrorModal] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        window.conveyor.app.version().then(setLauncherVersion)
        window.conveyor.app.getInstalledPatch().then((patch) => {
            setUtVersion(patch?.tag || 'Unknown')
        })
    }, [view])

    if (view === 'launcher') {
        return <LauncherSettings onBack={() => setView('main')} />
    }

    if (view === 'game') {
        return <UnrealTournamentSettings onBack={() => setView('main')} />
    }

    if (view === 'installation') {
        return <GameInstallationSettings onBack={() => setView('main')} />
    }

    return (
        <div className="space-y-6">
            <ErrorModal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                title="Invalid Installation"
                message={errorMessage}
            />
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
                    onClick={async () => {
                        const status = await window.conveyor.game.validateCurrentInstallation()
                        if (!status.valid || status.version === 'Unsupported') {
                            setErrorMessage('No valid UT99 installation found or the installation is unsupported. Please check your installation settings.')
                            setShowErrorModal(true)
                        } else {
                            setView('game')
                        }
                    }}
                    className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-lg bg-red-500/10 text-red-500 group-hover:bg-red-500/20 transition-colors">
                            <Joystick className="size-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">UT99 Settings</h3>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => setView('installation')}
                    className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                            <HardDrive className="size-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">UT99 Installation/Patches</h3>
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
