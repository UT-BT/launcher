import { ArrowLeft, Monitor, Keyboard } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface UnrealTournamentSettingsProps {
    onBack: () => void
}

export function UnrealTournamentSettings({ onBack }: UnrealTournamentSettingsProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="size-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Unreal Tournament</h2>
                    <p className="text-muted-foreground">Configure game-specific settings.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                            <Monitor className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">Video Settings</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Configure resolution, renderer (OpenGL/Direct3D), and brightness.</p>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
                            <Keyboard className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">Input & Controls</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Bind keys, adjust mouse sensitivity, and configure controller settings.</p>
                </div>
            </div>
        </div>
    )
}
