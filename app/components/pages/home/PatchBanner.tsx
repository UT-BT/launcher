import { Download, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface PatchBannerProps {
    tag: string
    releaseNotesUrl: string
    onInstall: () => void
    onDismiss: () => void
}

export function PatchBanner({ tag, releaseNotesUrl, onInstall, onDismiss }: PatchBannerProps) {
    return (
        <div className="mt-4 animate-in slide-in-from-top-4 duration-500">
            <div className="relative group overflow-hidden bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl backdrop-blur-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="flex items-center gap-5 relative z-10">
                    <div className="size-14 rounded-2xl bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform duration-500">
                        <Download className="size-7 text-blue-400" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-white/90 tracking-tight">
                            Unreal Tournament <span className="text-blue-400">{tag}</span> is now available
                        </h3>
                        <p className="text-sm text-muted-foreground font-medium">
                            Install it now to get the latest features and fixes. Release notes are available{' '}
                            <a href={releaseNotesUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">here</a>.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <Button
                        onClick={onInstall}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-xl shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                        Install
                    </Button>
                    <button
                        onClick={onDismiss}
                        className="size-12 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-white/10 hover:text-white transition-all"
                    >
                        <X className="size-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}
