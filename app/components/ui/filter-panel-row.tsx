interface FilterPanelRowProps {
    label: string
    children: React.ReactNode
}

export function FilterPanelRow({ label, children }: FilterPanelRowProps) {
    return (
        <div className="border-t border-hairline/5 pt-3 first:border-t-0 first:pt-0">
            <div className="text-xs font-bold uppercase tracking-wider text-foreground/80 mb-2">{label}</div>
            <div className="flex flex-wrap items-end gap-3">{children}</div>
        </div>
    )
}
