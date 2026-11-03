import { Suspense, lazy } from 'react'
import { usePlatform } from '@/app/platform'
import { StreamCard, StreamLoading } from '../StreamCard'
import { camsPanelView } from './camsGate'
import { DesktopLauncherNotice } from './DesktopLauncherNotice'
import { CamSides } from './cams/CamSides'

const CamTool = lazy(() => import('./CamTool').then(m => ({ default: m.CamTool })))

export function CamsPanel() {
    const { capabilities } = usePlatform()

    return (
        <div className="space-y-4">
            <CamSides />
            {camsPanelView(capabilities) === 'web-notice' ? (
                <CamsWebNotice />
            ) : (
                <Suspense fallback={<StreamLoading label="the cam tool" />}>
                    <CamTool />
                </Suspense>
            )}
        </div>
    )
}

function CamsWebNotice() {
    return (
        <StreamCard title="Cams" description="The cam tool needs the desktop launcher.">
            <p className="max-w-3xl text-sm text-foreground">
                It starts four spectator copies of the game on your PC, one per player, each following its player and titled for OBS.
                A browser can't start the game, so the cams run from the desktop launcher. Everything else in this tab works here.
            </p>
            <DesktopLauncherNotice />
        </StreamCard>
    )
}
