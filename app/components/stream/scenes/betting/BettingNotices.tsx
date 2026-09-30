export function PredictionsNotEnabled() {
    return (
        <div data-betting-not-enabled className="flex h-full flex-col items-center justify-center gap-[18px] text-center leading-[1.2]">
            <svg aria-hidden width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M4.9 4.9l14.2 14.2" />
            </svg>
            <p className="text-[84px] font-black italic uppercase leading-none">Predictions not enabled</p>
            <p className="font-sans text-[30px] text-white/60">This event has no prediction market.</p>
        </div>
    )
}

export function NoMarket() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-[18px] text-center">
            <p className="text-[64px] font-black italic uppercase leading-none">No market yet</p>
            <p className="font-sans text-[26px] text-white/60">Predictions open for this match once both teams are known.</p>
        </div>
    )
}
