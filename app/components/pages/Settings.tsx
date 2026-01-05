import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SettingsLayout, SettingsSectionId } from './settings/SettingsLayout'
import { LauncherGeneralSettings } from './settings/LauncherGeneralSettings'
import { LauncherDemoSettings } from './settings/LauncherDemoSettings'
import { GameInstallationSettings } from './GameInstallationSettings'
import { GamePlayerSettings } from './settings/GamePlayerSettings'
import { GameInputSettings } from './settings/GameInputSettings'
import { GameVideoSettings } from './settings/GameVideoSettings'
import { GameAudioSettings } from './settings/GameAudioSettings'
import { GameGameplaySettings } from './settings/GameGameplaySettings'

export interface SettingsProps {
    initialSection?: string
}

export function Settings({ initialSection }: SettingsProps = {}) {
    const [currentSection, setCurrentSection] = useState<SettingsSectionId>((initialSection as SettingsSectionId) || 'launcher-general')
    const [isGameValid, setIsGameValid] = useState(false)
    const [gameVersion, setGameVersion] = useState<string>('')
    const [launcherVersion, setLauncherVersion] = useState<string>('')

    const checkGame = async () => {
        try {
            if (typeof window.conveyor.app.version === 'function') {
                const ver = await window.conveyor.app.version()
                setLauncherVersion(ver)
            } else {
                setLauncherVersion((window.conveyor.app.version as unknown as string) || 'Unknown')
            }

            const status = await window.conveyor.game.validateCurrentInstallation()
            setIsGameValid(status.valid && status.version !== 'Unsupported')
            if (status.valid) {
                setGameVersion(status.version || '')
            } else {
                setGameVersion('')
            }
        } catch (err) {
            console.error('Failed to validate game installation', err)
            setIsGameValid(false)
            setGameVersion('')
        }
    }

    useEffect(() => {
        checkGame()

        const cleanupProfile = window.utProfile?.onChanged ? window.utProfile.onChanged(checkGame) : undefined
        const cleanupPatch = window.utPatch?.onPatchInstallStatus ? window.utPatch.onPatchInstallStatus(() => checkGame()) : undefined
        const cleanupPath = window.utPatch?.onInstallationPathUpdated ? window.utPatch.onInstallationPathUpdated(() => setTimeout(() => checkGame(), 500)) : undefined

        return () => {
            cleanupProfile?.()
            cleanupPatch?.()
            cleanupPath?.()
        }
    }, [])

    const renderSection = () => {
        switch (currentSection) {
            case 'launcher-general':
                return <LauncherGeneralSettings />
            case 'launcher-demos':
                return <LauncherDemoSettings />
            case 'game-installation':
                return <GameInstallationSettings />
            case 'game-player':
                return <GamePlayerSettings />
            case 'game-controls':
                return <GameInputSettings />
            case 'game-video':
                return <GameVideoSettings />
            case 'game-audio':
                return <GameAudioSettings />
            case 'game-gameplay':
                return <GameGameplaySettings />
            default:
                return <LauncherGeneralSettings />
        }
    }

    return (
        <SettingsLayout
            currentSection={currentSection}
            onSectionChange={setCurrentSection}
            isGameValid={isGameValid}
            gameVersion={gameVersion}
            launcherVersion={launcherVersion}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSection}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                >
                    {renderSection()}
                </motion.div>
            </AnimatePresence>
        </SettingsLayout>
    )
}
