import { lazy, Suspense, useState } from 'react'
import { SettingsLayout, type SettingsSectionId } from './settings/SettingsLayout'
import { LauncherAppearanceSettings } from './settings/LauncherAppearanceSettings'
import { useDesktopPromo } from '@/app/components/desktopPromo/useDesktopPromo'

const PrivacySettings = lazy(() => import('./settings/PrivacySettings').then(m => ({ default: m.PrivacySettings })))
const GameSettingsPlaceholder = lazy(() => import('./settings/GameSettingsPlaceholder').then(m => ({ default: m.GameSettingsPlaceholder })))

export interface WebSettingsProps {
    initialSection?: string
    unlockExclusive?: boolean
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

export function WebSettings({ initialSection, unlockExclusive }: WebSettingsProps) {
    const requested = initialSection as SettingsSectionId | undefined
    const [selectedSection, setSelectedSection] = useState<SettingsSectionId>(
        requested === 'launcher-privacy' ? requested : 'launcher-appearance',
    )
    const { eligible } = useDesktopPromo()
    const currentSection = selectedSection === 'game-web-placeholder' && !eligible ? 'launcher-appearance' : selectedSection
    const panel = (() => {
        switch (currentSection) {
            case 'launcher-privacy': return <PrivacySettings />
            case 'game-web-placeholder': return <GameSettingsPlaceholder />
            default: return <LauncherAppearanceSettings unlockExclusive={unlockExclusive} />
        }
    })()

    return (
        <SettingsLayout
            currentSection={currentSection}
            onSectionChange={setSelectedSection}
            isGameValid={false}
            launcherVersion={__APP_VERSION__}
            initialDetail={requested === 'launcher-privacy' || requested === 'launcher-appearance'}
        >
            <Suspense key={currentSection} fallback={<PanelLoading />}>{panel}</Suspense>
        </SettingsLayout>
    )
}