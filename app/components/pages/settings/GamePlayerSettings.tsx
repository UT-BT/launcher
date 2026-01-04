import { useState, useEffect } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import { SettingsSection, SettingsRow } from './SettingsComponents'

export function GamePlayerSettings() {
    const [playerName, setPlayerName] = useState('')
    const [playerTeam, setPlayerTeam] = useState('0')
    const [isSpectator, setIsSpectator] = useState(false)

    useEffect(() => {
        loadSettings()
    }, [])

    useEffect(() => {
        if (window.utProfile && window.utProfile.onChanged) {
            const cleanup = window.utProfile.onChanged(() => {
                loadSettings()
            })
            return cleanup
        }
        return undefined
    }, [])

    const loadSettings = async () => {
        const name = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'Name')
        setPlayerName(name || 'Player')

        const team = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'team')
        setPlayerTeam(team || '0')

        const overrideClass = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'OverrideClass')
        setIsSpectator(overrideClass === 'Botpack.CHSpectator')
    }

    const savePlayerSettings = async () => {
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'Name', playerName)
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', playerTeam)
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', isSpectator ? 'Botpack.CHSpectator' : '')
    }

    return (
        <div className="space-y-6">
            <div className="pl-1">
                <h2 className="text-2xl font-bold tracking-tight">Player Settings</h2>
                <p className="text-muted-foreground">Configure your identity and appearance.</p>
            </div>

            <SettingsSection title="Identity" icon={User}>
                <SettingsRow
                    label="Name"
                    description="Your in-game name. Max 20 characters."
                >
                    <Input
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onBlur={savePlayerSettings}
                        maxLength={20}
                        className="w-full"
                    />
                </SettingsRow>

                <SettingsRow
                    label="Team"
                    description="Your preferred team color."
                >
                    <div className="flex gap-2 w-full">
                        <Button
                            variant={playerTeam === '0' ? 'default' : 'outline'}
                            className={cn(
                                "flex-1 transition-all duration-200 h-9",
                                playerTeam === '0'
                                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                                    : "hover:border-red-500 hover:text-red-500 hover:bg-red-50"
                            )}
                            onClick={() => {
                                setPlayerTeam('0')
                                window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', '0')
                            }}
                        >
                            Red
                        </Button>
                        <Button
                            variant={playerTeam === '1' ? 'default' : 'outline'}
                            className={cn(
                                "flex-1 transition-all duration-200 h-9",
                                playerTeam === '1'
                                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                    : "hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50"
                            )}
                            onClick={() => {
                                setPlayerTeam('1')
                                window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', '1')
                            }}
                        >
                            Blue
                        </Button>
                    </div>
                </SettingsRow>

                <SettingsRow
                    label="Join As"
                    description="Choose whether to join games as a player or spectator."
                >
                    <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={isSpectator ? 'yes' : 'no'}
                        onChange={(e) => {
                            const val = e.target.value === 'yes'
                            setIsSpectator(val)
                            window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', val ? 'Botpack.CHSpectator' : '')
                        }}
                    >
                        <option value="no">Player</option>
                        <option value="yes">Spectator</option>
                    </select>
                </SettingsRow>
            </SettingsSection>
        </div>
    )
}
