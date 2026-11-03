import { DesktopAppNotice } from '@/app/components/desktopPromo/DesktopAppNotice'

export function DesktopLauncherNotice() {
    return (
        <DesktopAppNotice
            source="stream"
            message="Get the desktop launcher for Windows"
            fallback={<p className="max-w-3xl text-sm text-muted-foreground">Use the desktop launcher (Windows) for this.</p>}
            className="max-w-3xl"
        />
    )
}
