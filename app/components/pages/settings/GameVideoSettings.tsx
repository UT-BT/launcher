import { useState, useEffect } from 'react'
import { Monitor, Download, Upload, Sliders } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Slider } from '@/app/components/ui/slider'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { Switch } from '@/app/components/ui/switch'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import { RENDER_DEVICE_SETTINGS, LEGACY_RENDERERS, getAvailableResolutions } from './constants'

export function GameVideoSettings() {
    const [renderDevice, setRenderDevice] = useState('')
    const [resX, setResX] = useState('1920')
    const [resY, setResY] = useState('1080')
    const [colorBits, setColorBits] = useState('32')
    const [fpsLimit, setFpsLimit] = useState('0')
    const [netspeed, setNetspeed] = useState(10000)
    const [deviceSettings, setDeviceSettings] = useState<Record<string, any>>({})

    // Import/Export state
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
            const device = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice')
            setRenderDevice(device || 'D3D9Drv.D3D9RenderDevice')

            const x = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX')
            setResX(x || '1920')

            const y = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY')
            setResY(y || '1080')

            const bits = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenColorBits')
            setColorBits(bits || '32')

            const fps = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FrameRateLimit')
            setFpsLimit(fps || '0')

            const speed = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed')
            setNetspeed(parseInt(speed || '10000', 10))

            if (device) {
                const settingsConfig = RENDER_DEVICE_SETTINGS[device]
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
                    setDeviceSettings(currentSettings)
                } else {
                    setDeviceSettings({})
                }
            }
        } catch (err) {
            console.error('Failed to load video settings', err)
        }
    }

    const handleRenderDeviceChange = async (newDevice: string) => {
        setRenderDevice(newDevice)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice', newDevice)

        // Reload settings for new device
        const settingsConfig = RENDER_DEVICE_SETTINGS[newDevice]
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
            setDeviceSettings(currentSettings)
        } else {
            setDeviceSettings({})
        }
    }

    const updateDeviceSetting = async (key: string, value: any) => {
        setDeviceSettings(prev => ({ ...prev, [key]: value }))

        const settingDef = RENDER_DEVICE_SETTINGS[renderDevice]?.find(s => s.key === key)
        let stringValue = String(value)

        if (settingDef?.type === 'boolean') {
            if (key === 'SwapInterval') {
                stringValue = value ? '1' : '0'
            } else {
                stringValue = value ? 'True' : 'False'
            }
        }

        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', renderDevice, key, stringValue)
    }

    const handleResolutionChange = async (val: string) => {
        const [x, y] = val.split('x')
        setResX(x)
        setResY(y)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX', x)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY', y)
    }

    const saveVideoSettings = async () => {
        // Triggered on blur of standard inputs if needed, but mostly we save on change except text inputs
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FrameRateLimit', fpsLimit)
    }

    const handleExportVideoSettings = () => {
        const exportData = {
            version: '1.0',
            renderer: renderDevice,
            exportedAt: new Date().toISOString(),
            settings: deviceSettings
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ut99-video-${renderDevice.split('.')[0]}-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleImportVideoSettings = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                const data = JSON.parse(text)

                if (!data.renderer || !data.settings) {
                    setImportError('Invalid video settings file.')
                    setPendingImportData(null)
                    setShowImportModal(true)
                    return
                }
                if (data.renderer !== renderDevice) {
                    setImportError(`File is for ${data.renderer}, but checking ${renderDevice}. Please switch renderer first if you wish to import this.`)
                    setPendingImportData(null)
                    setShowImportModal(true)
                    return
                }

                setPendingImportData(data.settings)
                setImportError('')
                setShowImportModal(true)
            } catch (err) {
                setImportError('Failed to parse settings file.')
                setPendingImportData(null)
                setShowImportModal(true)
            }
        }
        input.click()
    }

    const confirmImport = async () => {
        if (!pendingImportData) return

        setDeviceSettings(pendingImportData)
        for (const [key, value] of Object.entries(pendingImportData)) {
            await updateDeviceSetting(key, value)
        }

        setShowImportModal(false)
        setPendingImportData(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="pl-1">
                    <h2 className="text-2xl font-bold tracking-tight">Video Settings</h2>
                    <p className="text-muted-foreground">Configure display and graphics options.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportVideoSettings} className="gap-2">
                        <Download className="size-4" /> Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportVideoSettings} className="gap-2">
                        <Upload className="size-4" /> Import
                    </Button>
                </div>
            </div>

            <SettingsSection title="Display" icon={Monitor}>
                <SettingsRow
                    label="Render Device"
                    description={
                        LEGACY_RENDERERS[renderDevice] ? (
                            <span className="text-red-500 italic">
                                <span className="font-semibold">{LEGACY_RENDERERS[renderDevice]}</span> is a legacy renderer and not recommended for use on modern systems.
                            </span>
                        ) : "Select your preferred graphics renderer."
                    }
                >
                    <select
                        className="flex h-9 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={renderDevice}
                        onChange={(e) => handleRenderDeviceChange(e.target.value)}
                    >
                        <option value="D3D9Drv.D3D9RenderDevice">Direct3D 9</option>
                        <option value="D3D11Drv.D3D11RenderDevice">Direct3D 11</option>
                        <option value="ICBINDx11Drv.ICBINDx11RenderDevice">Direct3D 11 (ICBIND)</option>
                        <option value="OpenGLDrv.OpenGLRenderDevice">OpenGL</option>
                        <option value="XOpenGLDrv.XOpenGLRenderDevice">XOpenGL</option>
                        <option value="VulkanDrv.VulkanRenderDevice">Vulkan</option>
                        <option value="SoftDrv.SoftwareRenderDevice">Software Rendering</option>
                        <option value="GlideDrv.GlideRenderDevice">3dfx Glide</option>
                        <option value="MetalDrv.MetalRenderDevice">S3 Metal</option>
                    </select>
                </SettingsRow>

                <SettingsRow
                    label="Resolution"
                    description="Set the game resolution."
                >
                    <select
                        className="flex h-9 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={`${resX}x${resY}`}
                        onChange={(e) => handleResolutionChange(e.target.value)}
                    >
                        <option value={`${window.screen.width}x${window.screen.height}`}>
                            {window.screen.width}x{window.screen.height} (Recommended)
                        </option>
                        {getAvailableResolutions(window.screen.width, window.screen.height)
                            .filter(res => res !== `${window.screen.width}x${window.screen.height}`)
                            .map(res => (
                                <option key={res} value={res}>{res}</option>
                            ))}
                        {![`${window.screen.width}x${window.screen.height}`, ...getAvailableResolutions(window.screen.width, window.screen.height)].includes(`${resX}x${resY}`) && (
                            <option value={`${resX}x${resY}`}>{resX}x{resY} (Custom)</option>
                        )}
                    </select>
                </SettingsRow>

                <SettingsRow
                    label="Color Depth"
                    description={
                        colorBits === '16'
                            ? <span className="text-yellow-500 italic">16-bit color is not recommended for modern systems. 32-bit is highly recommended.</span>
                            : "Set the color bit depth."
                    }
                >
                    <select
                        className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={colorBits}
                        onChange={async (e) => {
                            setColorBits(e.target.value)
                            await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenColorBits', e.target.value)
                        }}
                    >
                        <option value="16">16-bit</option>
                        <option value="32">32-bit</option>
                    </select>
                </SettingsRow>

                <SettingsRow
                    label="FPS Limit"
                    description="Set your frames per second. We recommend 0 (uncapped) for best input response."
                >
                    <Input
                        value={fpsLimit}
                        onChange={(e) => setFpsLimit(e.target.value)}
                        onBlur={saveVideoSettings}
                        type="number"
                        className="w-32 h-9"
                    />
                </SettingsRow>

                <SettingsRow
                    label="Netspeed"
                    description={`Control connection speed. Recommended: 25000. Current: ${netspeed}`}
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
            </SettingsSection>

            {/* Dynamic Render Device Settings */}
            {RENDER_DEVICE_SETTINGS[renderDevice] && (
                <SettingsSection title={`${renderDevice.split('.')[0]} Settings`} icon={Sliders}>
                    {RENDER_DEVICE_SETTINGS[renderDevice].map(setting => (
                        <SettingsRow
                            key={setting.key}
                            label={setting.label}
                            description={setting.tooltip}
                        >
                            {setting.type === 'boolean' && (
                                <Switch
                                    checked={!!deviceSettings[setting.key]}
                                    onCheckedChange={(checked) => updateDeviceSetting(setting.key, checked)}
                                />
                            )}

                            {setting.type === 'number' && (
                                <div className="flex items-center gap-4 w-48">
                                    <Slider
                                        min={setting.min ?? 0}
                                        max={setting.max ?? 100}
                                        step={setting.step ?? 1}
                                        value={deviceSettings[setting.key] ?? 0}
                                        onChange={(e) => {
                                            setDeviceSettings(prev => ({ ...prev, [setting.key]: parseFloat(e.target.value) }))
                                        }}
                                        onMouseUp={() => {
                                            updateDeviceSetting(setting.key, deviceSettings[setting.key])
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="text-xs font-mono w-8 text-right">{deviceSettings[setting.key]}</span>
                                </div>
                            )}

                            {setting.type === 'select' && (
                                <select
                                    className="flex h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={deviceSettings[setting.key] ?? ''}
                                    onChange={(e) => updateDeviceSetting(setting.key, e.target.value)}
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

            <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Import Video Settings">
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
