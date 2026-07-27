import { lazy, Suspense, useState } from 'react'
import { SettingsLayout, type SettingsSectionId } from './settings/SettingsLayout'
import { LauncherAppearanceSettings } from './settings/LauncherAppearanceSettings'

const PrivacySettings = lazy(() => import('./settings/PrivacySettings').then(m => ({ default: m.PrivacySettings })))

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
    const [currentSection, setCurrentSection] = useState<SettingsSectionId>(
        requested === 'launcher-privacy' ? requested : 'launcher-appearance',
    )

    return (
        <SettingsLayout
            currentSection={currentSection}
            onSectionChange={setCurrentSection}
            isGameValid={false}
            launcherVersion={__APP_VERSION__}
            initialDetail={requested === 'launcher-privacy'}
        >
            <Suspense fallback={<PanelLoading />}>
                {currentSection === 'launcher-privacy'
                    ? <PrivacySettings />
                    : <LauncherAppearanceSettings unlockExclusive={unlockExclusive} />}
            </Suspense>
        </SettingsLayout>
    )
}