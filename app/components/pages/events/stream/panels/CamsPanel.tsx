import { Suspense, lazy } from 'react'
import { Download } from 'lucide-react'
import { usePlatform } from '@/app/platform'
import { StreamCard, StreamLoading } from '../StreamCard'
import { camsPanelView } from './camsGate'
import { CamSides } from './cams/CamSides'

const DESKTOP_LAUNCHER_URL = 'https://github.com/UT-BT/launcher/releases/latest'

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
            <a
                href={DESKTOP_LAUNCHER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25"
            >
                <Download className="size-3.5" /> Get the desktop launcher
            </a>
        </StreamCard>
    )
}
