interface DataTableExpandRowProps {
    colSpan: number
    id?: string
    children: React.ReactNode
}

export function DataTableExpandRow({ colSpan, id, children }: DataTableExpandRowProps) {
    return (
        <tr id={id} className="border-b border-hairline/5 bg-hairline/[0.02]">
            <td colSpan={colSpan} className="px-4 py-4">{children}</td>
        </tr>
    )
}
