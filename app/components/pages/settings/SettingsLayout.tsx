import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Monitor, User, Keyboard, Volume2, Gamepad2, HardDrive, Settings, FileVideo, Palette, ShieldCheck, ChevronRight, ChevronLeft } from "lucide-react"
import { IS_WEB } from '@/app/platform'

export type SettingsSectionId =
    | 'launcher-general'
    | 'launcher-appearance'
    | 'launcher-demos'
    | 'launcher-privacy'
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
    initialDetail?: boolean
}

export function SettingsLayout({ currentSection, onSectionChange, children, isGameValid, gameVersion, launcherVersion, initialDetail }: SettingsLayoutProps) {
    const [compactDetail, setCompactDetail] = useState(Boolean(initialDetail))
    const backRef = useRef<HTMLButtonElement>(null)
    const railRefs = useRef<Partial<Record<SettingsSectionId, HTMLButtonElement | null>>>({})
    const settled = useRef(false)

    useEffect(() => {
        if (!settled.current) {
            settled.current = true
            return
        }
        const active = document.activeElement as HTMLElement | null
        if (active && active !== document.body && active.offsetParent !== null) return
        const target = compactDetail ? backRef.current : railRefs.current[currentSection]
        target?.focus()
    }, [compactDetail, currentSection])

    const sidebarItems = [
        {
            group: "Launcher",
            items: IS_WEB
                ? [
                    { id: 'launcher-appearance', label: 'Appearance', icon: Palette },
                    { id: 'launcher-privacy', label: 'Privacy', icon: ShieldCheck },
                ]
                : [
                    { id: 'launcher-general', label: 'General', icon: Settings },
                    { id: 'launcher-appearance', label: 'Appearance', icon: Palette },
                    { id: 'launcher-demos', label: 'Demos', icon: FileVideo },
                    { id: 'launcher-privacy', label: 'Privacy', icon: ShieldCheck },
                ]
        },
        ...(!IS_WEB ? [{
            group: "Unreal Tournament",
            items: [
                { id: 'game-installation', label: 'Installation', icon: HardDrive },
                { id: 'game-player', label: 'Player', icon: User, disabled: !isGameValid },
                { id: 'game-controls', label: 'Controls', icon: Keyboard, disabled: !isGameValid },
                { id: 'game-video', label: 'Video', icon: Monitor, disabled: !isGameValid },
                { id: 'game-audio', label: 'Audio', icon: Volume2, disabled: !isGameValid },
                { id: 'game-gameplay', label: 'Gameplay', icon: Gamepad2, disabled: !isGameValid },
            ]
        }] : [])
    ]

    const selectSection = (section: SettingsSectionId) => {
        onSectionChange(section)
        setCompactDetail(true)
    }

    return (
        <div className="flex h-full overflow-hidden">
            <aside
                aria-label="Settings sections"
                className={cn(
                    "flex flex-col pt-4 @max-3xl/settings:w-full @3xl/settings:w-72 shrink-0",
                    compactDetail && "@max-3xl/settings:hidden"
                )}
            >
                <div className="w-full flex-1 overflow-y-auto px-4 pt-2 space-y-8 sm:px-6 @max-3xl/settings:mx-auto @max-3xl/settings:max-w-lg @3xl/settings:pt-6">
                    {sidebarItems.map((group) => (
                        <div key={group.group}>
                            <h3 className="mb-3 px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
                                {group.group}
                            </h3>
                            <div className="space-y-2 @3xl/settings:space-y-1">
                                {group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        ref={(el) => { railRefs.current[item.id as SettingsSectionId] = el }}
                                        onClick={() => !item.disabled && selectSection(item.id as SettingsSectionId)}
                                        disabled={item.disabled}
                                        aria-current={currentSection === item.id ? 'page' : undefined}
                                        className={cn(
                                            "w-full flex items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-all duration-150",
                                            "@3xl/settings:rounded-lg @3xl/settings:border-transparent @3xl/settings:px-3 @3xl/settings:py-2.5 @3xl/settings:active:scale-100",
                                            currentSection === item.id
                                                ? "border-primary/40 bg-primary/10 text-primary @3xl/settings:shadow-sm @3xl/settings:shadow-primary/5"
                                                : "border-hairline/10 bg-card/50 text-muted-foreground hover:border-hairline/20 hover:bg-card/80 hover:text-foreground @3xl/settings:bg-transparent @3xl/settings:hover:bg-muted/50",
                                            item.disabled
                                                ? "opacity-30 cursor-not-allowed hover:border-hairline/10 hover:bg-card/50 hover:text-muted-foreground @3xl/settings:hover:bg-transparent"
                                                : "active:scale-[0.99] active:border-hairline/30"
                                        )}
                                    >
                                        <span className={cn(
                                            "flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors",
                                            "@3xl/settings:bg-transparent @3xl/settings:p-0",
                                            currentSection === item.id ? "bg-primary/15 text-primary" : "bg-hairline/10 @3xl/settings:text-inherit"
                                        )}>
                                            <item.icon className={cn(
                                                "size-5 shrink-0 transition-transform duration-200 @3xl/settings:size-4.5",
                                                currentSection === item.id && "@3xl/settings:scale-110"
                                            )} />
                                        </span>
                                        <span className="min-w-0 truncate text-left">{item.label}</span>
                                        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/50 @3xl/settings:hidden" />
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

            <main
                className={cn(
                    "@container/panel flex-1 overflow-y-auto min-w-0 @max-3xl/settings:w-full",
                    !compactDetail && "@max-3xl/settings:hidden"
                )}
            >
                <div className="sticky top-0 z-10 flex items-center border-b border-border/30 bg-card/95 px-2 py-1 backdrop-blur-sm @3xl/settings:hidden">
                    <button
                        ref={backRef}
                        onClick={() => setCompactDetail(false)}
                        aria-label="Back to settings sections"
                        className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/60 active:text-foreground"
                    >
                        <ChevronLeft className="size-4" />
                        Back
                    </button>
                </div>
                <div className="max-w-4xl mx-auto p-4 @lg/panel:p-6 @3xl/panel:p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
