import { useState, useEffect, useCallback } from 'react'
import { Keyboard, Download, Upload, AlertTriangle, Zap, Star, Wand2, Layout } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { SettingsSection, SettingsRow } from './SettingsComponents'
import { BIND_CATEGORIES, ALIAS_DEFINITIONS } from './constants'

export function GameInputSettings() {
    const [binds, setBinds] = useState<Record<string, string[]>>({})
    const [editingBind, setEditingBind] = useState<{ command: string, slot: number } | null>(null)
    const [conflictInfo, setConflictInfo] = useState<{
        key: string,
        newCommand: string,
        newSlot: number,
        existingCommand: string
    } | null>(null)

    // Import state
    const [showImportModal, setShowImportModal] = useState(false)
    const [importError, setImportError] = useState('')
    const [pendingImportData, setPendingImportData] = useState<Record<string, string[]> | null>(null)

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
            const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
            if (inputSection) {
                const newBinds: Record<string, string[]> = {}
                Object.entries(inputSection).forEach(([key, commandValue]) => {
                    const commands = Array.isArray(commandValue) ? commandValue : [commandValue]
                    commands.forEach(command => {
                        if (!command) return
                        const normalizedCommand = command.toLowerCase()
                        if (!newBinds[normalizedCommand]) {
                            newBinds[normalizedCommand] = []
                        }
                        const isDuplicate = newBinds[normalizedCommand].some(k => k.toLowerCase() === key.toLowerCase())

                        if (!isDuplicate && newBinds[normalizedCommand].length < 2) {
                            newBinds[normalizedCommand].push(key)
                        }
                    })
                })
                setBinds(newBinds)
            }
        } catch (err) {
            console.error('Failed to load input settings', err)
        }
    }

    const ensureAliasExists = useCallback(async (aliasName: string, command: string) => {
        const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
        if (!inputSection) return

        const aliasMatchRegex = /\(.*?Alias="?(.*?)"?.*?\)/i
        const commandMatchRegex = /\(.*?Command="(.*?)"?.*?\)/i

        const existingAlias = Object.entries(inputSection).find(([_, value]) => {
            const values = Array.isArray(value) ? value : [value]
            return values.some(v => {
                if (typeof v !== 'string') return false
                const match = v.match(aliasMatchRegex)
                return match && match[1].toLowerCase() === aliasName.toLowerCase()
            })
        })

        if (existingAlias) {
            const val = Array.isArray(existingAlias[1]) ? existingAlias[1][0] : existingAlias[1]
            if (typeof val === 'string') {
                const match = val.match(commandMatchRegex)
                if (match && match[1] === command) return
            }
            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', existingAlias[0], `(Command="${command}",Alias="${aliasName}")`)
            return
        }

        let targetKey = ''
        const emptySlot = Object.entries(inputSection).find(([key, value]) => {
            if (!key.startsWith('Aliases[')) return false
            const values = Array.isArray(value) ? value : [value]
            return values.some(v => typeof v === 'string' && v.match(/\(Command="",\s*Alias="?None"?\)/i))
        })

        if (emptySlot) {
            targetKey = emptySlot[0]
        } else {
            let nextIndex = 0
            const indices = Object.keys(inputSection).map(k => {
                const m = k.match(/Aliases\[(\d+)\]/)
                return m ? parseInt(m[1], 10) : -1
            }).filter(i => i !== -1)
            if (indices.length > 0) nextIndex = Math.max(...indices) + 1
            targetKey = `Aliases[${nextIndex}]`
        }

        await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', targetKey, `(Command="${command}",Alias="${aliasName}")`)
    }, [])

    const applyBind = useCallback(async (key: string, command: string, slot: number) => {
        try {
            const normalizedCommand = command.toLowerCase()

            if (ALIAS_DEFINITIONS[normalizedCommand]) {
                await ensureAliasExists(normalizedCommand, ALIAS_DEFINITIONS[normalizedCommand])
            }

            const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
            if (inputSection) {
                const keysToRemove: string[] = []
                Object.keys(inputSection).forEach(existingKey => {
                    if (existingKey.toLowerCase() === key.toLowerCase()) {
                        keysToRemove.push(existingKey)
                    }
                })
                const oldKey = binds[normalizedCommand]?.[slot]
                if (oldKey && oldKey.toLowerCase() !== key.toLowerCase()) {
                    keysToRemove.push(oldKey)
                }

                // Execute removals
                for (const k of keysToRemove) {
                    await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', k, null)
                }
            }

            // Write the new bind
            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, command)

            setBinds(prev => {
                const newBinds = { ...prev }

                Object.keys(newBinds).forEach(cmd => {
                    const cmdBinds = newBinds[cmd]
                    if (Array.isArray(cmdBinds)) {
                        newBinds[cmd] = cmdBinds.map(k => k.toLowerCase() === key.toLowerCase() ? '' : k)
                    }
                })

                // Add 'key' to target command
                if (!newBinds[normalizedCommand]) newBinds[normalizedCommand] = []
                while (newBinds[normalizedCommand].length <= slot) newBinds[normalizedCommand].push('')
                newBinds[normalizedCommand][slot] = key

                return newBinds
            })
        } catch (err) {
            console.error('Failed to apply bind', err)
        } finally {
            setEditingBind(null)
            setConflictInfo(null)
        }
    }, [binds, ensureAliasExists])

    const handleInput = useCallback(async (key: string) => {
        if (!editingBind) return
        const { command, slot } = editingBind

        // Check conflict
        let existingCommand = ''
        Object.entries(binds).forEach(([cmd, keys]) => {
            if (keys.some(k => k.toLowerCase() === key.toLowerCase()) && cmd.toLowerCase() !== command.toLowerCase()) {
                existingCommand = cmd
            }
        })

        if (existingCommand) {
            // Find readable name
            const readableRaw = existingCommand
            const readable = BIND_CATEGORIES.flatMap(c => c.binds).find(b => b.command.toLowerCase() === readableRaw)?.label || readableRaw

            setConflictInfo({
                key,
                newCommand: command,
                newSlot: slot,
                existingCommand: readable
            })
            setEditingBind(null)
            return
        }

        await applyBind(key, command, slot)
    }, [editingBind, binds, applyBind])

    const confirmConflict = async () => {
        if (!conflictInfo) return
        await applyBind(conflictInfo.key, conflictInfo.newCommand, conflictInfo.newSlot)
    }

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
        if ((e.target as HTMLElement).closest('button')) return // Don't capture valid clicks
        e.preventDefault()
        e.stopPropagation()
        const buttonMap: Record<number, string> = { 0: 'LeftMouse', 1: 'MiddleMouse', 2: 'RightMouse', 3: 'Mouse4', 4: 'Mouse5' }
        const utKey = buttonMap[e.button]
        if (utKey) handleInput(utKey)
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
        return undefined
    }, [editingBind, handleKeyDown, handleMouseDown, handleWheel])

    const handleBindClick = (command: string, slot: number) => {
        setEditingBind({ command, slot })
    }

    const mapKeyToUT = (code: string): string => {
        const map: Record<string, string> = {
            'ControlLeft': 'Ctrl', 'ControlRight': 'Ctrl', 'ShiftLeft': 'Shift', 'ShiftRight': 'Shift',
            'AltLeft': 'Alt', 'AltRight': 'Alt', 'Space': 'Space', 'Enter': 'Enter', 'Escape': 'Escape',
            'Backspace': 'Backspace', 'Tab': 'Tab', 'CapsLock': 'CapsLock', 'Delete': 'Delete', 'Insert': 'Insert',
            'Home': 'Home', 'End': 'End', 'PageUp': 'PageUp', 'PageDown': 'PageDown', 'ArrowUp': 'Up',
            'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'NumLock': 'NumLock',
            'ScrollLock': 'ScrollLock', 'Pause': 'Pause', 'PrintScreen': 'PrintScrn', 'Backquote': 'Tilde',
            'Minus': '-', 'Equal': '=', 'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\',
            'Semicolon': ';', 'Quote': "'", 'Comma': ',', 'Period': '.', 'Slash': '/'
        }
        if (map[code]) return map[code]
        if (code.startsWith('Key')) return code.slice(3)
        if (code.startsWith('Digit')) return code.slice(5)
        if (code.startsWith('Numpad')) return code
        return code
    }

    const handleExportBinds = () => {
        const configurableCommands = BIND_CATEGORIES.flatMap(c => c.binds).map(b => b.command.toLowerCase())
        const filteredBinds: Record<string, string[]> = {}
        for (const command of configurableCommands) {
            if (binds[command]) filteredBinds[command] = binds[command]
        }
        const exportData = { version: '1.0', exportedAt: new Date().toISOString(), binds: filteredBinds }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ut-keybinds-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleImportBinds = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                const data = JSON.parse(text)
                if (!data.binds || typeof data.binds !== 'object') {
                    setImportError('Invalid keybind file format')
                    setPendingImportData(null)
                    setShowImportModal(true)
                    return
                }
                setPendingImportData(data.binds)
                setImportError('')
                setShowImportModal(true)
            } catch {
                setImportError('Failed to parse keybind settings file.')
                setPendingImportData(null)
                setShowImportModal(true)
            }
        }
        input.click()
    }

    const confirmImport = async () => {
        if (!pendingImportData) return
        try {
            const inputSection = await window.conveyor.ini.readIniSection('User.ini', 'Engine.Input') as Record<string, string | string[]> | undefined
            if (inputSection) {
                for (const key of Object.keys(inputSection)) {
                    if (key.match(/Aliases\[(\d+)\]/i)) continue
                    await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, null)
                }
            }

            for (const [name, command] of Object.entries(ALIAS_DEFINITIONS)) {
                await ensureAliasExists(name, command)
            }

            for (const [command, keys] of Object.entries(pendingImportData)) {
                if (Array.isArray(keys)) {
                    for (const key of keys) {
                        if (key) {
                            // Map command to original case from definitions if possible
                            const originalCommand = BIND_CATEGORIES.flatMap(c => c.binds).find(b => b.command.toLowerCase() === command)?.command || command
                            await window.conveyor.ini.writeIniValue('User.ini', 'Engine.Input', key, originalCommand)

                            // If it's an alias command, ensure it exists in Aliases[]
                            if (ALIAS_DEFINITIONS[command.toLowerCase()]) {
                                await ensureAliasExists(command.toLowerCase(), ALIAS_DEFINITIONS[command.toLowerCase()])
                            }
                        }
                    }
                }
            }
            setShowImportModal(false)
            setPendingImportData(null)
            loadSettings()
        } catch (err) {
            console.error(err)
            setImportError('Failed to apply settings.')
        }
    }

    const getCategoryIcon = (name: string) => {
        switch (name) {
            case 'Essentials': return Zap
            case 'UTBT Specific Binds': return Star
            case 'Custom Aliases': return Wand2
            case 'Interface': return Layout
            case 'Movement': return Keyboard
            default: return Keyboard
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="pl-1">
                    <h2 className="text-2xl font-bold tracking-tight">Controls & Input</h2>
                    <p className="text-muted-foreground">Manage key bindings and input configuration.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportBinds} className="gap-2">
                        <Download className="size-4" /> Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportBinds} className="gap-2">
                        <Upload className="size-4" /> Import
                    </Button>
                </div>
            </div>

            {BIND_CATEGORIES.map((category) => (
                <SettingsSection key={category.name} title={category.name} icon={getCategoryIcon(category.name)}>
                    {category.binds.map((bind) => (
                        <SettingsRow
                            key={bind.command}
                            label={bind.label}
                            description={bind.tooltip}
                        >
                            <div className="flex gap-2">
                                {[0, 1].map(slot => {
                                    const keys = binds[bind.command.toLowerCase()] || []
                                    const keyRaw = keys[slot] || 'None'
                                    const isEditing = editingBind?.command === bind.command && editingBind?.slot === slot

                                    return (
                                        <Button
                                            key={slot}
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "min-w-[100px] font-mono transition-all",
                                                isEditing && "border-accent-500 text-accent-500 animate-pulse ring-2 ring-accent-500/20"
                                            )}
                                            onClick={() => handleBindClick(bind.command, slot)}
                                        >
                                            {isEditing ? 'Press Key...' : keyRaw}
                                        </Button>
                                    )
                                })}
                            </div>
                        </SettingsRow>
                    ))}
                </SettingsSection>
            ))}

            {/* Editing Overlay */}
            {editingBind && (
                <div data-modal-backdrop className="fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-64 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-card border border-border p-6 rounded-lg shadow-lg max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold">Press any key</h3>
                        <p className="text-muted-foreground">Press a key to bind to <b>{BIND_CATEGORIES.flatMap(c => c.binds).find(b => b.command === editingBind.command)?.label}</b></p>
                        <p className="text-xs text-muted-foreground">Press ESC to cancel</p>
                    </div>
                </div>
            )}

            {/* Conflict Dialog */}
            <Modal
                isOpen={!!conflictInfo}
                onClose={() => setConflictInfo(null)}
                title="Bind Conflict"
                className="max-w-lg"
                backdropClassName="left-64"
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="outline" onClick={() => setConflictInfo(null)}>Cancel</Button>
                        <Button onClick={confirmConflict}>Reassign</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-yellow-500 mb-2">
                        <AlertTriangle className="size-5" />
                        <span className="font-semibold">Conflict Detected</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        The key <span className="font-bold text-foreground">{conflictInfo?.key}</span> is already bound to <span className="font-bold text-foreground">{conflictInfo?.existingCommand}</span>.
                        <br /><br />
                        Do you want to reassign it?
                    </p>
                </div>
            </Modal>

            <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Import Binds" footer={null}>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {importError ? <span className="text-red-500">{importError}</span> : "Are you sure you want to import these binds? exact existing binds will be wiped and replaced."}
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
