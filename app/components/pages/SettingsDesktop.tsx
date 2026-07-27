import { lazy, Suspense, useState } from 'react'
import { SettingsLayout, type SettingsSectionId } from './settings/SettingsLayout'
import { LauncherGeneralSettings } from './settings/LauncherGeneralSettings'

const LauncherAppearanceSettings = lazy(() => import('./settings/LauncherAppearanceSettings').then(m => ({ default: m.LauncherAppearanceSettings })))
const LauncherDemoSettings = lazy(() => import('./settings/LauncherDemoSettings').then(m => ({ default: m.LauncherDemoSettings })))
const PrivacySettings = lazy(() => import('./settings/PrivacySettings').then(m => ({ default: m.PrivacySettings })))
const GameInstallationSettings = lazy(() => import('./GameInstallationSettings').then(m => ({ default: m.GameInstallationSettings })))
const GamePlayerSettings = lazy(() => import('./settings/GamePlayerSettings').then(m => ({ default: m.GamePlayerSettings })))
const GameInputSettings = lazy(() => import('./settings/GameInputSettings').then(m => ({ default: m.GameInputSettings })))
const GameVideoSettings = lazy(() => import('./settings/GameVideoSettings').then(m => ({ default: m.GameVideoSettings })))
const GameAudioSettings = lazy(() => import('./settings/GameAudioSettings').then(m => ({ default: m.GameAudioSettings })))
const GameGameplaySettings = lazy(() => import('./settings/GameGameplaySettings').then(m => ({ default: m.GameGameplaySettings })))

export interface DesktopSettingsProps {
    initialSection?: string
    unlockExclusive?: boolean
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
}

function PanelLoading() {
    return (
        <div className="space-y-4 animate-pulse" aria-label="Loading settings">
            <div className="h-7 w-40 rounded bg-hairline/10" />
            <div className="h-4 w-72 max-w-full rounded bg-hairline/5" />
            <div className="h-36 rounded-xl border border-hairline/5 bg-card/30" />
        </div>
    )
}

export function DesktopSettings({ initialSection, unlockExclusive, installationStatus }: DesktopSettingsProps) {
    const [currentSection, setCurrentSection] = useState<SettingsSectionId>(
        (initialSection as SettingsSectionId) || 'launcher-general',
    )
    const panel = (() => {
        switch (currentSection) {
            case 'launcher-appearance': return <LauncherAppearanceSettings unlockExclusive={unlockExclusive} />
            case 'launcher-demos': return <LauncherDemoSettings />
            case 'launcher-privacy': return <PrivacySettings />
            case 'game-installation': return <GameInstallationSettings />
            case 'game-player': return <GamePlayerSettings />
            case 'game-controls': return <GameInputSettings />
            case 'game-video': return <GameVideoSettings />
            case 'game-audio': return <GameAudioSettings />
            case 'game-gameplay': return <GameGameplaySettings />
            default: return <LauncherGeneralSettings />
        }
    })()

    return (
        <SettingsLayout
            currentSection={currentSection}
            onSectionChange={setCurrentSection}
            isGameValid={installationStatus === 'valid'}
            launcherVersion={__APP_VERSION__}
            initialDetail={Boolean(initialSection)}
        >
            <Suspense fallback={<PanelLoading />}>{panel}</Suspense>
        </SettingsLayout>
    )
}