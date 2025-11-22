import { Settings as SettingsIcon, FileText, Monitor, Volume2, Keyboard } from 'lucide-react'

export function Settings() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage your game configuration and launcher preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div className="p-3 rounded-lg bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
                            <Volume2 className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">Audio Settings</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Adjust volume levels, sound quality, and voice chat options.</p>
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

                <div className="p-6 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                            <FileText className="size-6" />
                        </div>
                        <h3 className="text-lg font-semibold">INI Editor</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Directly edit UnrealTournament.ini and User.ini files.</p>
                </div>
            </div>
        </div>
    )
}
