import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, User, Monitor, Keyboard, Download, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Slider } from '@/app/components/ui/slider'
import { Tooltip } from '@/app/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface UnrealTournamentSettingsProps {
    onBack: () => void
}

interface BindCategory {
    name: string
    binds: { label: string; command: string; tooltip?: string }[]
}

const BIND_CATEGORIES: BindCategory[] = [
    {
        name: 'Essentials',
        binds: [
            { label: 'Fire', command: 'fire' },
            { label: 'Alt Fire', command: 'altfire' },
            { label: 'Move Forward', command: 'moveforward' },
            { label: 'Move Backward', command: 'movebackward' },
            { label: 'Move Left', command: 'strafeleft' },
            { label: 'Move Right', command: 'straferight' },
            { label: 'Jump', command: 'jump' },
            {
                label: 'Walk Jump',
                command: 'walking|jump',
                tooltip: 'Walk Jumps are a special bind in Unreal Tournament that let you jump with less height than a regular jump, which can be useful for gaining time on maps. If you have jumpboots, then walk jump will allow you to jump without using a boot jump.'
            },
            { label: 'Walk', command: 'walking' },
            { label: 'Crouch', command: 'duck' },
            { label: 'Suicide', command: 'suicide' },
        ]
    },
    {
        name: 'UTBT Specific Binds',
        binds: [
            { label: 'Open UTBT MapVote', command: 'mutate bdbmapvote votemenu' },
            { label: 'Open UTBT Settings', command: 'mutate bte' },
            { label: 'Dodge Forward', command: 'utbtforwarddodge', tooltip: 'Allows you to dodge forward with one button' },
            { label: 'Dodge Backward', command: 'utbtbackdodge', tooltip: 'Allows you to dodge backward with one button' },
            { label: 'Dodge Left', command: 'utbtleftdodge', tooltip: 'Allows you to dodge left with one button' },
            { label: 'Dodge Right', command: 'utbtrightdodge', tooltip: 'Allows you to dodge right with one button' },
        ]
    },
    {
        name: 'Game & Tools',
        binds: [
            { label: 'Set Checkpoint', command: 'mutate checkpoint', tooltip: 'Sets a checkpoint at your current location. You will respawn here if you die.' },
            { label: 'Remove Checkpoints', command: 'mutate nocheckpoint', tooltip: 'Removes all your checkpoints from the map.' },
            { label: 'Teleport Forward', command: 'mutate tp', tooltip: 'Teleports you forward in the map. This will set you on a checkpoint run.' },
            { label: 'Ghost', command: 'mutate ghost', tooltip: 'Allows you to ghost through maps. This will set you on a checkpoint run.' },
            { label: 'Fly', command: 'mutate fly', tooltip: 'Allows you to fly through maps. This will set you on a checkpoint run.' },
            { label: 'Walk', command: 'mutate walk', tooltip: 'Sets you back to a walking state.' },
        ]
    },
    {
        name: 'Interface',
        binds: [
            { label: 'Show/Hide Scoreboard', command: 'ShowScores' },
            { label: 'Show Network Info', command: 'stat net' },
            { label: 'Spectate Player', command: 'viewteam' },
            { label: 'Take Screenshot', command: 'sshot' },
        ]
    }
]

const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b)
}

const getAvailableResolutions = (nativeWidth: number, nativeHeight: number): string[] => {
    const divisor = gcd(nativeWidth, nativeHeight)
    const aspectWidth = nativeWidth / divisor
    const aspectHeight = nativeHeight / divisor
    const resolutionsByAspectRatio: Record<string, string[]> = {
        // 16:9 (most common)
        '16:9': ['1280x720', '1366x768', '1600x900', '1920x1080', '2560x1440', '3840x2160'],
        // 16:10
        '16:10': ['1280x800', '1440x900', '1680x1050', '1920x1200', '2560x1600', '3840x2400'],
        // 4:3 (older monitors)
        '4:3': ['640x480', '800x600', '1024x768', '1280x960', '1600x1200', '2048x1536'],
        // 21:9 (ultrawide)
        '21:9': ['2560x1080', '3440x1440', '3840x1600', '5120x2160'],
        // 32:9 (super ultrawide)
        '32:9': ['3840x1080', '5120x1440'],
        // 5:4
        '5:4': ['1280x1024', '2560x2048'],
    }

    const aspectRatioKey = `${aspectWidth}:${aspectHeight}`
    let resolutions = resolutionsByAspectRatio[aspectRatioKey] || []

    if (resolutions.length === 0) {
        const baseResolutions = [720, 900, 1080, 1440, 2160]
        resolutions = baseResolutions
            .map(height => {
                const width = Math.round((height * aspectWidth) / aspectHeight)
                return `${width}x${height}`
            })
            .filter(res => {
                const [w, h] = res.split('x').map(Number)
                return w <= nativeWidth && h <= nativeHeight
            })
    }

    const filteredResolutions = resolutions.filter(res => {
        const [w, h] = res.split('x').map(Number)
        return w <= nativeWidth && h <= nativeHeight
    })

    return filteredResolutions
}

export function UnrealTournamentSettings({ onBack }: UnrealTournamentSettingsProps) {
    // Player Settings
    const [playerName, setPlayerName] = useState('')
    const [playerTeam, setPlayerTeam] = useState('0')
    const [isSpectator, setIsSpectator] = useState(false)

    // Video Settings
    const [renderDevice, setRenderDevice] = useState('')
    const [resX, setResX] = useState('1920')
    const [resY, setResY] = useState('1080')
    const [fpsLimit, setFpsLimit] = useState('0')
    const [netspeed, setNetspeed] = useState(10000)

    // Binds
    const [binds, setBinds] = useState<Record<string, string[]>>({}) // command -> keys[]
    const [editingBind, setEditingBind] = useState<{ command: string, slot: number } | null>(null)

    // Import modal state
    const [importModalState, setImportModalState] = useState<'hidden' | 'loading' | 'success' | 'error'>('hidden')
    const [importErrorMessage, setImportErrorMessage] = useState('')

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            // Player
            const name = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'Name')
            setPlayerName(name || 'Player')

            const team = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'team')
            setPlayerTeam(team || '0')

            const overrideClass = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'OverrideClass')
            setIsSpectator(overrideClass === 'Botpack.CHSpectator')

            // Video
            const device = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice')
            setRenderDevice(device || 'D3D9Drv.D3D9RenderDevice')

            const x = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX')
            setResX(x || '1920')

            const y = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY')
            setResY(y || '1080')

            const fps = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FrameRateLimit')
            setFpsLimit(fps || '0')

            const speed = await window.conveyor.ini.readIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed')
            setNetspeed(parseInt(speed || '10000', 10))

            // Binds
            const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string> | undefined
            if (inputSection) {
                const newBinds: Record<string, string[]> = {}
                Object.entries(inputSection).forEach(([key, command]) => {
                    const normalizedCommand = command.toLowerCase()
                    if (!newBinds[normalizedCommand]) {
                        newBinds[normalizedCommand] = []
                    }
                    if (newBinds[normalizedCommand].length < 2) {
                        newBinds[normalizedCommand].push(key)
                    }
                })
                setBinds(newBinds)
            }
        } catch (err) {
            console.error('Failed to load settings', err)
        }
    }

    const savePlayerSettings = async () => {
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'Name', playerName)
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', playerTeam)
        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', isSpectator ? 'Botpack.CHSpectator' : '')
    }

    const saveVideoSettings = async () => {
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice', renderDevice)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX', resX)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY', resY)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FrameRateLimit', fpsLimit)
        await window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed', netspeed.toString())
    }

    const handleBindClick = (command: string, slot: number) => {
        setEditingBind({ command, slot })
    }

    const mapKeyToUT = (code: string): string => {
        const map: Record<string, string> = {
            'ControlLeft': 'Ctrl',
            'ControlRight': 'Ctrl',
            'ShiftLeft': 'Shift',
            'ShiftRight': 'Shift',
            'AltLeft': 'Alt',
            'AltRight': 'Alt',
            'Space': 'Space',
            'Enter': 'Enter',
            'Escape': 'Escape',
            'Backspace': 'Backspace',
            'Tab': 'Tab',
            'CapsLock': 'CapsLock',
            'Delete': 'Delete',
            'Insert': 'Insert',
            'Home': 'Home',
            'End': 'End',
            'PageUp': 'PageUp',
            'PageDown': 'PageDown',
            'ArrowUp': 'Up',
            'ArrowDown': 'Down',
            'ArrowLeft': 'Left',
            'ArrowRight': 'Right',
            'NumLock': 'NumLock',
            'ScrollLock': 'ScrollLock',
            'Pause': 'Pause',
            'PrintScreen': 'PrintScrn',
            'Backquote': 'Tilde',
            'Minus': '-',
            'Equal': '=',
            'BracketLeft': '[',
            'BracketRight': ']',
            'Backslash': '\\',
            'Semicolon': ';',
            'Quote': "'",
            'Comma': ',',
            'Period': '.',
            'Slash': '/',
        }

        if (map[code]) return map[code]
        if (code.startsWith('Key')) return code.slice(3)
        if (code.startsWith('Digit')) return code.slice(5)
        if (code.startsWith('Numpad')) return code

        return code
    }

    const handleInput = useCallback(async (key: string) => {
        if (!editingBind) return

        const { command, slot } = editingBind
        const normalizedCommand = command.toLowerCase()

        const val = binds[normalizedCommand]
        const currentBinds = Array.isArray(val) ? val : []
        const oldKey = currentBinds[slot]
        if (oldKey) {
            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', oldKey, '')
        }

        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, command)

        setBinds(prev => {
            const newBinds = { ...prev }

            Object.keys(newBinds).forEach(cmd => {
                const cmdBinds = newBinds[cmd]
                if (Array.isArray(cmdBinds)) {
                    newBinds[cmd] = cmdBinds.filter(k => k.toLowerCase() !== key.toLowerCase())
                } else {
                    // Handle legacy state or unexpected type
                    newBinds[cmd] = []
                }
            })

            if (!newBinds[normalizedCommand]) {
                newBinds[normalizedCommand] = []
            }
            while (newBinds[normalizedCommand].length <= slot) {
                newBinds[normalizedCommand].push('')
            }
            newBinds[normalizedCommand][slot] = key

            return newBinds
        })

        setEditingBind(null)
    }, [editingBind, binds])

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!editingBind) return
        e.preventDefault()
        e.stopPropagation()

        if (e.code === 'Escape') {
            setEditingBind(null)
            return
        }

        const utKey = mapKeyToUT(e.code)
        handleInput(utKey)
    }, [editingBind, handleInput])

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (!editingBind) return

        if ((e.target as HTMLElement).closest('button')) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        const buttonMap: Record<number, string> = {
            0: 'LeftMouse',
            1: 'MiddleMouse',
            2: 'RightMouse',
            3: 'Mouse4',
            4: 'Mouse5'
        }

        const utKey = buttonMap[e.button]
        if (utKey) {
            handleInput(utKey)
        }
    }, [editingBind, handleInput])

    const handleWheel = useCallback((e: WheelEvent) => {
        if (!editingBind) return
        e.preventDefault()
        e.stopPropagation()

        const utKey = e.deltaY < 0 ? 'MouseWheelUp' : 'MouseWheelDown'
        handleInput(utKey)
    }, [editingBind, handleInput])

    useEffect(() => {
        if (editingBind) {
            window.addEventListener('keydown', handleKeyDown)
            window.addEventListener('mousedown', handleMouseDown, { capture: true })
            window.addEventListener('wheel', handleWheel, { capture: true, passive: false })
            return () => {
                window.removeEventListener('keydown', handleKeyDown)
                window.removeEventListener('mousedown', handleMouseDown, { capture: true })
                window.removeEventListener('wheel', handleWheel, { capture: true })
            }
        }
    }, [editingBind, handleKeyDown, handleMouseDown, handleWheel])

    const handleClearBind = async () => {
        if (!editingBind) return

        const { command, slot } = editingBind
        const normalizedCommand = command.toLowerCase()
        const val = binds[normalizedCommand]
        const currentBinds = Array.isArray(val) ? val : []
        const currentKey = currentBinds[slot]

        if (currentKey) {
            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', currentKey, '')

            setBinds(prev => {
                const newBinds = { ...prev }
                if (newBinds[normalizedCommand]) {
                    const newCommandBinds = [...newBinds[normalizedCommand]]
                    newCommandBinds[slot] = ''
                    newBinds[normalizedCommand] = newCommandBinds
                }
                return newBinds
            })
        }
        setEditingBind(null)
    }

    const handleExportBinds = () => {
        const configurableCommands = BIND_CATEGORIES
            .flatMap(category => category.binds)
            .map(bind => bind.command.toLowerCase())

        const filteredBinds: Record<string, string[]> = {}
        for (const command of configurableCommands) {
            if (binds[command]) {
                filteredBinds[command] = binds[command]
            }
        }

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            binds: filteredBinds
        }

        const jsonString = JSON.stringify(exportData, null, 2)

        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `ut-keybinds-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleImportBinds = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            setImportModalState('loading')

            try {
                const text = await file.text()
                const importData = JSON.parse(text)

                if (!importData.binds || typeof importData.binds !== 'object') {
                    setImportErrorMessage('Invalid keybind file format')
                    setImportModalState('error')
                    return
                }

                const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string> | undefined
                if (inputSection) {
                    for (const key of Object.keys(inputSection)) {
                        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, '')
                    }
                }

                const importedBinds: Record<string, string[]> = importData.binds
                for (const [command, keys] of Object.entries(importedBinds)) {
                    if (Array.isArray(keys)) {
                        for (const key of keys) {
                            if (key) {
                                const originalCommand = BIND_CATEGORIES
                                    .flatMap(c => c.binds)
                                    .find(b => b.command.toLowerCase() === command)?.command || command

                                await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, originalCommand)
                            }
                        }
                    }
                }

                setBinds(importedBinds)

                setImportModalState('success')
            } catch (err) {
                console.error('Failed to import keybinds', err)
                setImportErrorMessage('Failed to import keybinds. Please check the file format.')
                setImportModalState('error')
            }
        }

        input.click()
    }

    return (
        <div className="space-y-6 pb-12 relative">
            {editingBind && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-200">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">Bind Action</h3>
                            <p className="text-muted-foreground">
                                Press any key, mouse button, or scroll wheel to bind to <span className="text-foreground font-semibold">"{BIND_CATEGORIES.flatMap(c => c.binds).find(b => b.command === editingBind.command)?.label}"</span> (Slot {editingBind.slot + 1})
                            </p>
                        </div>

                        <div className="p-8 border-2 border-dashed border-muted rounded-lg bg-muted/10 animate-pulse">
                            <span className="text-lg font-mono text-primary">Waiting for input...</span>
                        </div>

                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="destructive"
                                onClick={handleClearBind}
                            >
                                Clear Bind
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setEditingBind(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModalState !== 'hidden' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-card border border-border p-8 rounded-xl shadow-2xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-200">
                        {importModalState === 'loading' && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold">Importing Keybinds</h3>
                                    <p className="text-muted-foreground">
                                        Please wait while we import your keybind configuration...
                                    </p>
                                </div>

                                <div className="p-8 border-2 border-dashed border-muted rounded-lg bg-muted/10">
                                    <Loader2 className="size-12 mx-auto text-primary animate-spin" />
                                </div>
                            </>
                        )}

                        {importModalState === 'success' && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-green-500">Import Successful!</h3>
                                    <p className="text-muted-foreground">
                                        Your keybinds have been imported and applied successfully.
                                    </p>
                                </div>

                                <div className="p-8 rounded-lg bg-green-500/10">
                                    <CheckCircle className="size-16 mx-auto text-green-500" />
                                </div>

                                <Button
                                    onClick={() => setImportModalState('hidden')}
                                    className="w-full"
                                >
                                    Close
                                </Button>
                            </>
                        )}

                        {importModalState === 'error' && (
                            <>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-red-500">Import Failed</h3>
                                    <p className="text-muted-foreground">
                                        {importErrorMessage}
                                    </p>
                                </div>

                                <div className="p-8 rounded-lg bg-red-500/10">
                                    <XCircle className="size-16 mx-auto text-red-500" />
                                </div>

                                <Button
                                    variant="destructive"
                                    onClick={() => setImportModalState('hidden')}
                                    className="w-full"
                                >
                                    Close
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="size-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Unreal Tournament</h2>
                    <p className="text-muted-foreground">Configure game-specific settings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Player Settings */}
                <div className="p-6 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500">
                            <User className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">Player Details</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                onBlur={savePlayerSettings}
                                maxLength={20}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Team</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={playerTeam}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setPlayerTeam(val)
                                    window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'team', val)
                                }}
                            >
                                <option value="0">Red</option>
                                <option value="1">Blue</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Join As</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        </div>
                    </div>
                </div>

                {/* Video Settings */}
                <div className="p-6 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
                            <Monitor className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">Video Options</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Render Device</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={renderDevice}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setRenderDevice(val)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Engine', 'GameRenderDevice', val)
                                }}
                            >
                                <option value="D3D9Drv.D3D9RenderDevice">Direct3D 9</option>
                                <option value="D3D11Drv.D3D11RenderDevice">Direct3D 11</option>
                                <option value="OpenGLDrv.OpenGLRenderDevice">OpenGL</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Resolution</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={`${resX}x${resY}`}
                                onChange={(e) => {
                                    const [x, y] = e.target.value.split('x')
                                    setResX(x)
                                    setResY(y)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportX', x)
                                    window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'WinDrv.WindowsClient', 'FullscreenViewportY', y)
                                }}
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
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">FPS Limit (0 = Uncapped)</label>
                                <Tooltip content="Set your frames per second. In Unreal Tournament, FPS has some effect on how your game plays, but in general, we recommend setting this value to 0 (uncapped)." />
                            </div>
                            <Input
                                value={fpsLimit}
                                onChange={(e) => setFpsLimit(e.target.value)}
                                onBlur={saveVideoSettings}
                                type="number"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium">Netspeed</label>
                                    <Tooltip content="Netspeed is how fast your game client communicates with our servers. On our servers, this value must be set between 3,850 and 25,000. We recommend 25,000 for the best gameplay experience." />
                                </div>
                                <span className="text-sm text-muted-foreground">{netspeed}</span>
                            </div>
                            <Slider
                                min={3850}
                                max={25000}
                                step={50}
                                value={netspeed}
                                onChange={(e) => setNetspeed(parseInt(e.target.value))}
                                onMouseUp={() => window.conveyor.ini.writeIniValue('UnrealTournament.ini', 'Engine.Player', 'ConfiguredInternetSpeed', netspeed.toString())}
                            />
                        </div>
                    </div>
                </div>

                {/* Binds */}
                <div className="p-6 rounded-xl bg-card border border-border">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500">
                                <Keyboard className="size-6" />
                            </div>
                            <h3 className="text-lg font-semibold">Binds</h3>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportBinds}
                                className="gap-2"
                            >
                                <Download className="size-4" />
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleImportBinds}
                                className="gap-2"
                            >
                                <Upload className="size-4" />
                                Import
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {BIND_CATEGORIES.map((category) => (
                            <div key={category.name}>
                                <h4 className="text-md font-medium mb-4 text-muted-foreground">{category.name}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {category.binds.map((bind) => (
                                        <div key={bind.command} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{bind.label}</span>
                                                {bind.tooltip && <Tooltip content={bind.tooltip} />}
                                            </div>
                                            <div className="flex gap-2">
                                                {[0, 1].map(slot => (
                                                    <Button
                                                        key={slot}
                                                        variant="outline"
                                                        size="sm"
                                                        className={cn(
                                                            "min-w-[80px] font-mono",
                                                            editingBind?.command === bind.command && editingBind?.slot === slot && "border-blue-500 text-blue-500 animate-pulse"
                                                        )}
                                                        onClick={() => handleBindClick(bind.command, slot)}
                                                    >
                                                        {editingBind?.command === bind.command && editingBind?.slot === slot
                                                            ? 'Press Key...'
                                                            : ((Array.isArray(binds[bind.command.toLowerCase()]) ? binds[bind.command.toLowerCase()] : [])[slot] || 'None')}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
