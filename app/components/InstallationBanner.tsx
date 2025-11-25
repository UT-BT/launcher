import { AlertTriangle } from 'lucide-react'

interface InstallationBannerProps {
    type: 'no-install' | 'unsupported'
    onClick: () => void
}

export function InstallationBanner({ type, onClick }: InstallationBannerProps) {
    const message = type === 'no-install'
        ? <>You haven't configured a valid UT99 install. Click here to install a fresh copy or select an existing install.</>
        : <>You have an <strong>unsupported</strong> version of UT99 installed. Please install a new patch here.</>

    return (
        <div
            onClick={onClick}
            className="relative z-[60] w-full bg-destructive/100 border-b border-destructive/100 px-6 py-3 cursor-pointer hover:bg-destructive/80 transition-colors"
        >
            <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="size-5 flex-shrink-0 text-yellow-500" />
                <p className="text-sm font-medium text-yellow-500">
                    {message}
                </p>
            </div>
        </div>
    )
}
