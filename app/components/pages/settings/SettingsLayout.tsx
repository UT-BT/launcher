import { cn } from "@/lib/utils"
import { Monitor, User, Keyboard, Volume2, Gamepad2, HardDrive, Settings, FileVideo } from "lucide-react"

export type SettingsSectionId =
    | 'launcher-general'
    | 'launcher-demos'
    | 'game-installation'
    | 'game-player'
    | 'game-controls'
    | 'game-video'
    | 'game-audio'
    | 'game-gameplay'

interface SettingsLayoutProps {
    currentSection: SettingsSectionId
    onSectionChange: (section: SettingsSectionId) => void
    children: React.ReactNode
    isGameValid: boolean
    gameVersion?: string
    launcherVersion?: string
}

export function SettingsLayout({ currentSection, onSectionChange, children, isGameValid, gameVersion, launcherVersion }: SettingsLayoutProps) {

    const sidebarItems = [
        {
            group: "Launcher",
            items: [
                { id: 'launcher-general', label: 'General', icon: Settings },
                { id: 'launcher-demos', label: 'Demos', icon: FileVideo },
            ]
        },
        {
            group: "Unreal Tournament",
            items: [
                { id: 'game-installation', label: 'Installation', icon: HardDrive },
                { id: 'game-player', label: 'Player', icon: User, disabled: !isGameValid },
                { id: 'game-controls', label: 'Controls', icon: Keyboard, disabled: !isGameValid },
                { id: 'game-video', label: 'Video', icon: Monitor, disabled: !isGameValid },
                { id: 'game-audio', label: 'Audio', icon: Volume2, disabled: !isGameValid },
                { id: 'game-gameplay', label: 'Gameplay', icon: Gamepad2, disabled: !isGameValid },
            ]
        }
    ] as const

    return (
        <div className="flex h-full overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 flex flex-col pt-4">
                <div className="flex-1 overflow-y-auto pt-6 px-6 space-y-8">
                    {sidebarItems.map((group) => (
                        <div key={group.group}>
                            <h3 className="mb-3 px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                                {group.group}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => !item.disabled && onSectionChange(item.id as SettingsSectionId)}
                                        disabled={item.disabled}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                            currentSection === item.id
                                                ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                            item.disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                                        )}
                                    >
                                        <item.icon className={cn(
                                            "size-4.5 transition-transform duration-200",
                                            currentSection === item.id && "scale-110"
                                        )} />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t border-border/30 mt-auto space-y-1 opacity-50">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-center">
                        Launcher v{launcherVersion || 'Unknown'}
                    </div>
                    {gameVersion && (
                        <div className="text-[10px] uppercase font-bold tracking-wider text-center">
                            UT {gameVersion}
                        </div>
                    )}
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto min-w-0">
                <div className="max-w-4xl mx-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
