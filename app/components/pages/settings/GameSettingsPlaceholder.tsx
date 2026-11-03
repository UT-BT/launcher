import { Gamepad2 } from 'lucide-react'
import { DesktopAppNotice } from '@/app/components/desktopPromo/DesktopAppNotice'

export function GameSettingsPlaceholder() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold flex items-center gap-2"><Gamepad2 className="size-5" /> Unreal Tournament settings</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Installation, player, controls, video, audio and gameplay settings live in the desktop app, next to your game install.
                </p>
            </div>
            <DesktopAppNotice source="settings" message="Edit them with the desktop app" />
        </div>
    )
}
