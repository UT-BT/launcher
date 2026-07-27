import { useState, useEffect } from 'react'
import { Volume2, Download, Upload, Sliders } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Slider } from '@/app/components/ui/slider'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { Switch } from '@/app/components/ui/switch'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import { AUDIO_DEVICE_SETTINGS, AUDIO_DEVICE_INFO } from './constants'

export function GameAudioSettings() {
    const [audioDevice, setAudioDevice] = useState('')
    const [audioSettings, setAudioSettings] = useState<Record<string, any>>({})

    // Import/Export
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
            const device = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Engine', 'AudioDevice')
            setAudioDevice(device || 'Galaxy.GalaxyAudioSubsystem')

            if (device) {
                const settingsConfig = AUDIO_DEVICE_SETTINGS[device]
                if (settingsConfig) {
                    const currentSettings: Record<string, any> = {}
                    for (const setting of settingsConfig) {
                        const val = await window.conveyor.ini.readIniValue('UnrealTournament.ini', device, setting.key)
                        if (setting.type === 'boolean') {
                            currentSettings[setting.key] = val?.toLowerCase() === 'true' || val === '1'
                        } else if (setting.type === 'number') {
                            currentSettings[setting.key] = parseFloat(val || '0')
                        } else {
                            currentSettings[setting.key] = val
                        }
                    }
                    setAudioSettings(currentSettings)
                } else {
                    setAudioSettings({})
                }
            }
        } catch (err) {
            console.error('Failed to load audio settings', err)
        }
    }

    const handleAudioDeviceChange = async (newDevice: string) => {
        setAudioDevice(newDevice)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'AudioDevice', newDevice)

        // Reload settings for new device
        const settingsConfig = AUDIO_DEVICE_SETTINGS[newDevice]
        if (settingsConfig) {
            const currentSettings: Record<string, any> = {}
            for (const setting of settingsConfig) {
                const val = await window.conveyor.ini.readIniValue('UnrealTournament.ini', newDevice, setting.key)
                if (setting.type === 'boolean') {
                    currentSettings[setting.key] = val?.toLowerCase() === 'true' || val === '1'
                } else if (setting.type === 'number') {
                    currentSettings[setting.key] = parseFloat(val || '0')
                } else {
                    currentSettings[setting.key] = val
                }
            }
            setAudioSettings(currentSettings)
        } else {
            setAudioSettings({})
        }
    }

    const updateAudioSetting = async (key: string, value: any) => {
        setAudioSettings(prev => ({ ...prev, [key]: value }))

        const settingDef = AUDIO_DEVICE_SETTINGS[audioDevice]?.find(s => s.key === key)
        let stringValue = String(value)

        if (settingDef?.type === 'boolean') {
            stringValue = value ? 'True' : 'False'
        }

        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', audioDevice, key, stringValue)
    }

    const handleExportMusicSettings = () => {
        const exportData = {
            version: '1.0',
            device: audioDevice,
            exportedAt: new Date().toISOString(),
            settings: audioSettings
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ut-audio-${audioDevice.split('.')[0]}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleImportMusicSettings = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                const data = JSON.parse(text)

                if (!data.device || !data.settings) {
                    setImportError('Invalid audio settings file.')
                    setPendingImportData(null)
                    setShowImportModal(true)
                    return
                }

                setPendingImportData(data)
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

    const confirmImport = async () => {
        if (!pendingImportData) return

        const { settings, device: impDevice } = pendingImportData

        // Switch device if needed
        let targetDevice = audioDevice
        if (impDevice && impDevice !== audioDevice) {
            targetDevice = impDevice
            setAudioDevice(impDevice)
            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'AudioDevice', impDevice)
        }

        // Apply device settings
        if (settings) {
            setAudioSettings(settings)
            const settingsConfig = AUDIO_DEVICE_SETTINGS[targetDevice]
            for (const [key, value] of Object.entries(settings)) {
                const settingDef = settingsConfig?.find(s => s.key === key)
                let stringValue = String(value)

                if (settingDef?.type === 'boolean') {
                    stringValue = value ? 'True' : 'False'
                }
                await window.conveyor.ini.writeIniValue('UnrealTournament.ini', targetDevice, key, stringValue)
            }
        }

        setShowImportModal(false)
        setPendingImportData(null)
        loadSettings()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="pl-1">
                    <h2 className="text-2xl font-bold tracking-tight">Audio Settings</h2>
                    <p className="text-muted-foreground">Configure sound and music options.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportMusicSettings} className="gap-2">
                        <Download className="size-4" /> Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportMusicSettings} className="gap-2">
                        <Upload className="size-4" /> Import
                    </Button>
                </div>
            </div>

            <SettingsSection title="Audio Output" icon={Volume2}>
                <SettingsRow
                    label="Audio Device"
                    description={
                        AUDIO_DEVICE_INFO[audioDevice] ? (
                            <span className={cn(
                                "transition-colors duration-200 block mt-1",
                                audioDevice === 'ALAudio.ALAudioSubsystem'
                                    ? "text-green-500"
                                    : audioDevice === 'Cluster.ClusterAudioSubsystem'
                                        ? "text-orange-500"
                                        : "text-red-500"
                            )}>
                                {AUDIO_DEVICE_INFO[audioDevice].description}
                            </span>
                        ) : "Select your preferred audio driver."
                    }
                >
                    <select
                        className="flex h-9 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={audioDevice}
                        onChange={(e) => handleAudioDeviceChange(e.target.value)}
                    >
                        <option value="ALAudio.ALAudioSubsystem">{AUDIO_DEVICE_INFO['ALAudio.ALAudioSubsystem'].label}</option>
                        <option value="Cluster.ClusterAudioSubsystem">{AUDIO_DEVICE_INFO['Cluster.ClusterAudioSubsystem'].label}</option>
                        <option value="Galaxy.GalaxyAudioSubsystem">{AUDIO_DEVICE_INFO['Galaxy.GalaxyAudioSubsystem'].label}</option>
                    </select>
                </SettingsRow>
            </SettingsSection>

            {/* Dynamic Audio Device Settings */}
            {AUDIO_DEVICE_SETTINGS[audioDevice] && (
                <SettingsSection title={`${audioDevice.split('.')[0]} Settings`} icon={Sliders}>
                    {AUDIO_DEVICE_SETTINGS[audioDevice].map(setting => (
                        <SettingsRow
                            key={setting.key}
                            label={setting.label}
                            description={setting.tooltip}
                        >
                            {setting.type === 'boolean' && (
                                <Switch
                                    checked={!!audioSettings[setting.key]}
                                    onCheckedChange={(checked) => updateAudioSetting(setting.key, checked)}
                                />
                            )}

                            {setting.type === 'number' && (
                                <div className="flex items-center gap-4 w-48">
                                    <Slider
                                        min={setting.min ?? 0}
                                        max={setting.max ?? 100}
                                        step={setting.step ?? 1}
                                        value={audioSettings[setting.key] ?? 0}
                                        onChange={(e) => {
                                            setAudioSettings(prev => ({ ...prev, [setting.key]: parseFloat(e.target.value) }))
                                        }}
                                        onMouseUp={() => {
                                            updateAudioSetting(setting.key, audioSettings[setting.key])
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="text-xs font-mono w-8 text-right">{audioSettings[setting.key]}</span>
                                </div>
                            )}

                            {setting.type === 'select' && (
                                <select
                                    className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={audioSettings[setting.key] ?? ''}
                                    onChange={(e) => updateAudioSetting(setting.key, e.target.value)}
                                >
                                    {setting.options?.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            )}
                        </SettingsRow>
                    ))}
                </SettingsSection>
            )}

            <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Import Audio Settings" footer={null} portal>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {importError ? <span className="text-red-500">{importError}</span> : "Are you sure you want to import these settings? This will overwrite your current configuration."}
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setShowImportModal(false)}>Cancel</Button>
                        {!importError && <Button onClick={confirmImport}>Import</Button>}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
