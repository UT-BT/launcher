import { useState, useEffect } from 'react'
import { Joystick, Download, Upload, Zap, Eye } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { Modal } from '@/app/components/ui/modal'
import { Switch } from '@/app/components/ui/switch'
import { SettingsSection, SettingsRow } from './SettingsComponents'

export function GameGameplaySettings() {
    const [fov, setFov] = useState('90.000000')
    const [dodging, setDodging] = useState(true)
    const [netspeed, setNetspeed] = useState(10000)
    const [screenFlashes, setScreenFlashes] = useState(true)
    const [goreLevel, setGoreLevel] = useState<'normal' | 'reduced' | 'ultra-low'>('normal')
    const [weaponHand, setWeaponHand] = useState('0.000000')
    const [disableMacroDodging, setDisableMacroDodging] = useState(false)
    const [mouseInput, setMouseInput] = useState<'raw' | 'direct' | 'cursor'>('cursor')

    const [showImportModal, setShowImportModal] = useState(false)
    const [importError, setImportError] = useState('')
    const [pendingImportData, setPendingImportData] = useState<any>(null)

    useEffect(() => {
        loadSettings()
    }, [])

    useEffect(() => {
        if (window.utProfile) {
            return window.utProfile.onChanged(() => loadSettings())
        }
        return undefined
    }, [])

    const loadSettings = async () => {
        try {
            const fovVal = await window.conveyor.ini.readIniValue('User.ini', 'Engine.PlayerPawn', 'DesiredFOV')
            setFov(fovVal || '90.000000')

            const dodgeVal = await window.conveyor.ini.readIniValue('User.ini', 'Engine.PlayerPawn', 'DodgeClickTime')
            setDodging(dodgeVal !== '-1.000000')

            const flashesVal = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'ScreenFlashes')
            setScreenFlashes(flashesVal?.toLowerCase() === 'true')

            const speed = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed')
            setNetspeed(parseInt(speed || '10000', 10))

            const lowGore = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bLowGore')
            const veryLowGore = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bVeryLowGore')
            if (lowGore?.toLowerCase() === 'true' && veryLowGore?.toLowerCase() === 'true') {
                setGoreLevel('ultra-low')
            } else if (lowGore?.toLowerCase() === 'true') {
                setGoreLevel('reduced')
            } else {
                setGoreLevel('normal')
            }

            const handVal = await window.conveyor.ini.readIniValue('User.ini', 'Engine.PlayerPawn', 'Handedness')
            setWeaponHand(handVal || '0.000000')

            const useRaw = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseRawHIDInput')
            const useDirect = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseDirectInput')

            if (useRaw?.toLowerCase() === 'true') {
                setMouseInput('raw')
            } else if (useDirect?.toLowerCase() === 'true') {
                setMouseInput('direct')
            } else {
                setMouseInput('cursor')
            }

            // Macro dodging check
            const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
            if (inputSection) {
                const moveForwardAlias = Object.values(inputSection).find(v => {
                    const val = Array.isArray(v) ? v[0] : v
                    if (!val) return false
                    const match = val.match(/\(Command="(.*?)",Alias="?(.*?)"?\)/)
                    return match && match[2].toLowerCase() === 'moveforward'
                })
                const val = Array.isArray(moveForwardAlias) ? moveForwardAlias[0] : moveForwardAlias
                if (val) {
                    setDisableMacroDodging(val.includes('Speed=+') && val.includes('.1"'))
                }
            }

        } catch (err) {
            console.error('Failed to load gameplay settings', err)
        }
    }

    const updateMouseInput = async (mode: 'raw' | 'direct' | 'cursor') => {
        setMouseInput(mode)
        if (mode === 'raw') {
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseRawHIDInput', 'True')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseDirectInput', 'False')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'CaptureMouse', 'True')
        } else if (mode === 'direct') {
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseRawHIDInput', 'False')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseDirectInput', 'True')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'CaptureMouse', 'True')
        } else {
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseRawHIDInput', 'False')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'UseDirectInput', 'False')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'CaptureMouse', 'True')
        }
    }

    const updateFov = async (value: string) => {
        setFov(value)
        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.PlayerPawn', 'DesiredFOV', value)
    }

    const updateDodging = async (enabled: boolean) => {
        setDodging(enabled)
        const value = enabled ? '0.250000' : '-1.000000'
        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.PlayerPawn', 'DodgeClickTime', value)
    }

    const updateDisableMacroDodging = async (disabled: boolean) => {
        setDisableMacroDodging(disabled)
        try {
            const section = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]>
            if (!section) return

            const movements = ['MoveForward', 'MoveBackward', 'StrafeLeft', 'StrafeRight']
            const updates: Record<string, string> = {}

            for (const [key, value] of Object.entries(section)) {
                if (typeof value !== 'string') continue
                if (!key.toLowerCase().startsWith('aliases')) continue

                const match = value.match(/\(Command="(.*?)",Alias="?(.*?)"?\)/)
                if (match) {
                    const command = match[1]
                    const alias = match[2]

                    if (movements.some(m => m.toLowerCase() === alias.toLowerCase()) && command.includes('Speed=')) {
                        let newCommand = command

                        if (disabled) {
                            if (['moveforward', 'strafeleft'].includes(alias.toLowerCase())) {
                                newCommand = newCommand.replace(/(Speed=[+-]?\d+)\.(\d+)/g, '$1.1')
                            } else {
                                newCommand = newCommand.replace(/(Speed=[+-]?\d+)\.(\d+)/g, '$1.0')
                            }
                        } else {
                            newCommand = newCommand.replace(/(Speed=[+-]?\d+)\.(\d+)/g, '$1.0')
                        }

                        if (newCommand !== command) {
                            const hasQuotes = value.includes(`Alias="${alias}"`)
                            const newValue = `(Command="${newCommand}",Alias=${hasQuotes ? `"${alias}"` : alias})`
                            updates[key] = newValue
                        }
                    }
                }
            }

            // Batch update modified aliases
            for (const [key, val] of Object.entries(updates)) {
                await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, val)
            }

        } catch (err) {
            console.error('Failed to update macro dodging settings', err)
        }
    }

    const updateScreenFlashes = async (enabled: boolean) => {
        setScreenFlashes(enabled)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'ScreenFlashes', enabled ? 'True' : 'False')
    }

    const updateGoreLevel = async (level: 'normal' | 'reduced' | 'ultra-low') => {
        setGoreLevel(level)
        if (level === 'ultra-low') {
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bLowGore', 'True')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bVeryLowGore', 'True')
        } else if (level === 'reduced') {
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bLowGore', 'True')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bVeryLowGore', 'False')
        } else {
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bLowGore', 'False')
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.GameInfo', 'bVeryLowGore', 'False')
        }
    }

    const updateWeaponHand = async (value: string) => {
        setWeaponHand(value)
        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.PlayerPawn', 'Handedness', value)
    }

    const handleExportGameSettings = () => {
        const exportData = {
            version: '1.0',
            type: 'game',
            settings: { fov, dodging, screenFlashes, goreLevel, weaponHand }
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ut99-game-settings-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleImportGameSettings = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                const data = JSON.parse(text)
                if (data.type !== 'game' || !data.settings) {
                    setImportError('Invalid game settings file.')
                    setPendingImportData(null)
                    setShowImportModal(true)
                    return
                }
                setPendingImportData(data.settings)
                setImportError('')
                setShowImportModal(true)
            } catch {
                setImportError('Failed to parse settings file.')
                setPendingImportData(null)
                setShowImportModal(true)
            }
        }
        input.click()
    }

    const applyImport = async () => {
        if (!pendingImportData) return
        const s = pendingImportData
        if (s.fov) await updateFov(s.fov)
        if (s.dodging !== undefined) await updateDodging(s.dodging)
        if (s.screenFlashes !== undefined) await updateScreenFlashes(s.screenFlashes)
        if (s.goreLevel) await updateGoreLevel(s.goreLevel)
        if (s.weaponHand) await updateWeaponHand(s.weaponHand)
        setShowImportModal(false)
        setPendingImportData(null)
        loadSettings()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="pl-1">
                    <h2 className="text-2xl font-bold tracking-tight">Gameplay Settings</h2>
                    <p className="text-muted-foreground">Configure FOV, weapon handling, and other game options.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportGameSettings} className="gap-2">
                        <Download className="size-4" /> Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportGameSettings} className="gap-2">
                        <Upload className="size-4" /> Import
                    </Button>
                </div>
            </div>

            <SettingsSection
                title="Input & Video Options"
                icon={Joystick}
            >
                <SettingsRow
                    label="Mouse Input"
                    description={
                        mouseInput === 'raw' ? (
                            <span className="text-green-500">Recommended for modern systems. (New in v469)</span>
                        ) : mouseInput === 'direct' ? (
                            <span className="text-orange-500">Successor to legacy input. Good alternative if Raw feels wrong.</span>
                        ) : (
                            <span className="text-red-500">Legacy input method. Not recommended.</span>
                        )
                    }
                >
                    <select
                        className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={mouseInput}
                        onChange={(e) => updateMouseInput(e.target.value as any)}
                    >
                        <option value="raw">Raw Input</option>
                        <option value="direct">Direct Input</option>
                        <option value="cursor">Cursor</option>
                    </select>
                </SettingsRow>

                <SettingsRow
                    label="Field of View (FOV)"
                    description={`Higher values allow you to see more.`}
                >
                    <div className="flex items-center gap-4 w-48">
                        <span className="text-xs font-mono w-8">{parseFloat(fov).toFixed(0)}</span>
                        <Slider
                            min={60}
                            max={120}
                            step={1}
                            value={parseFloat(fov)}
                            onChange={(e) => setFov(parseFloat(e.target.value).toFixed(6))}
                            onMouseUp={() => updateFov(fov)}
                            className="flex-1"
                        />
                    </div>
                </SettingsRow>

                <SettingsRow
                    label="Netspeed"
                    description={`Control connection speed. Recommended: 25000.`}
                >
                    <div className="flex items-center gap-4 w-48">
                        <Slider
                            min={3850}
                            max={25000}
                            step={50}
                            value={netspeed}
                            onChange={(e) => setNetspeed(parseInt(e.target.value))}
                            onMouseUp={() => window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed', netspeed.toString())}
                            className="flex-1"
                        />
                        <span className="text-xs font-mono w-10 text-right">{netspeed}</span>
                    </div>
                </SettingsRow>

                <SettingsRow
                    label="Weapon Hand"
                    description="Choose your weapon model position."
                >
                    <select
                        className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={weaponHand}
                        onChange={(e) => updateWeaponHand(e.target.value)}
                    >
                        <option value="-1.000000">Right</option>
                        <option value="1.000000">Left</option>
                        <option value="0.000000">Center</option>
                        <option value="2.000000">Hidden</option>
                    </select>
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Game Mechanics" icon={Zap}>
                <SettingsRow
                    label="Dodging"
                    description="Enable dodging in game (double tap movement key)."
                >
                    <Switch
                        checked={dodging}
                        onCheckedChange={updateDodging}
                    />
                </SettingsRow>

                <SettingsRow
                    label="Disable Macro Dodging"
                    description="Prevents accidental dodges when fat-fingering inputs."
                >
                    <Switch
                        checked={disableMacroDodging}
                        onCheckedChange={updateDisableMacroDodging}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Visuals & Gore" icon={Eye}>
                <SettingsRow
                    label="Screen Flashes"
                    description="Flash screen when taking damage or picking up items."
                >
                    <Switch
                        checked={screenFlashes}
                        onCheckedChange={updateScreenFlashes}
                    />
                </SettingsRow>

                <SettingsRow
                    label="Gore Level"
                    description="Controls the amount of blood and gibs."
                >
                    <select
                        className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={goreLevel}
                        onChange={(e) => updateGoreLevel(e.target.value as any)}
                    >
                        <option value="normal">Normal</option>
                        <option value="reduced">Reduced</option>
                        <option value="ultra-low">Ultra-Low</option>
                    </select>
                </SettingsRow>
            </SettingsSection>

            <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Import Game Settings" footer={null} portal>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {importError ? (
                            <span className="text-red-500">{importError}</span>
                        ) : (
                            "Are you sure you want to import these settings? This will overwrite your current configuration."
                        )}
                    </p>
                    {pendingImportData && !importError && (
                        <div className="py-2">
                            <div className="text-sm text-muted-foreground">
                                Verify the settings before importing.
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setShowImportModal(false)}>Cancel</Button>
                        {!importError && <Button onClick={applyImport}>Import</Button>}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
