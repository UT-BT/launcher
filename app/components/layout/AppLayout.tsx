import { ReactNode, useEffect } from 'react'
import { Home, Server, Trophy, Map as MapIcon, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import logo from '@/app/assets/logo.png'

interface NavItem {
    id: string
    label: string
    icon: React.ElementType
}

const navItems: NavItem[] = [
    { id: 'home', label: 'Activity', icon: Home },
    { id: 'servers', label: 'Servers', icon: Server },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
    { id: 'maps', label: 'Maps', icon: MapIcon },
    { id: 'settings', label: 'Settings', icon: Settings },
]

interface AppLayoutProps {
    children: ReactNode
    currentView: string
    onViewChange: (view: string) => void
}

export function AppLayout({ children, currentView, onViewChange }: AppLayoutProps) {
    useEffect(() => {
        const saved = localStorage.getItem('ui-scale')
        if (saved) {
            document.documentElement.style.zoom = `${saved}%`
        }
    }, [])

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
            <div className="nebula-bg absolute inset-0 opacity-30 pointer-events-none" />

            {/* Sidebar */}
            <aside className="w-64 bg-card/50 backdrop-blur-xl border-r border-white/10 flex flex-col z-20 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

                <div className="p-6 flex flex-col items-center relative z-10">
                    <img
                        src={logo}
                        alt="UTBT Logo"
                        className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.3)] mb-4 transition-transform hover:scale-105 duration-300"
                    />
                </div>

                <nav className="flex-1 px-4 space-y-2 relative z-10">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer group relative overflow-hidden",
                                currentView === item.id
                                    ? "text-white shadow-[0_0_20px_rgba(29,78,216,0.3)]"
                                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                            )}
                        >
                            {currentView === item.id && (
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-red-600/20 border-l-2 border-blue-500" />
                            )}

                            <item.icon className={cn(
                                "size-5 transition-colors duration-200 relative z-10",
                                currentView === item.id ? "text-blue-400" : "group-hover:text-blue-400/80"
                            )} />
                            <span className="relative z-10 font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10 relative z-10">
                    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5">
                        <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-red-500 p-[1px]">
                            <div className="w-full h-full rounded-full bg-black/50 backdrop-blur-sm" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">Player</span>
                            <span className="text-xs text-green-400 flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                                Online
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative z-10">
                <div className="p-8 min-h-full">
                    {children}
                </div>
            </main>
        </div>
    )
}
