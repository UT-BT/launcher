import logo from '@/app/assets/logo.webp'

export function SceneLogo({ className }: { className: string }) {
    return <img src={logo} alt="UTBT" className={className} />
}

export function SceneBranding({ eventName, subtitle }: { eventName: string | null; subtitle: string | null }) {
    return (
        <div className="flex min-w-0 items-center gap-[22px]">
            <SceneLogo className="size-24 shrink-0 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]" />
            <div className="min-w-0">
                {eventName && <p className="truncate text-[28px] font-bold uppercase leading-none tracking-[0.3em] text-white/90">{eventName}</p>}
                {subtitle && <p className="mt-2.5 truncate text-xl font-semibold uppercase leading-none tracking-[0.18em] text-white/50">{subtitle}</p>}
            </div>
        </div>
    )
}
