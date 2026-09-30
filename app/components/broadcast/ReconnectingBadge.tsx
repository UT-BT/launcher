export function ReconnectingBadge() {
    return (
        <div
            role="status"
            className="absolute bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-card px-2.5 py-1.5 text-xs font-medium text-amber-300"
        >
            Connection lost, reconnecting…
        </div>
    )
}
