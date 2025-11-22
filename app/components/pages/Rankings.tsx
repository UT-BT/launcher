import { Trophy } from 'lucide-react'

export function Rankings() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-4 rounded-full bg-muted">
                <Trophy className="size-8 text-muted-foreground" />
            </div>
            <div>
                <h2 className="text-2xl font-bold">Rankings</h2>
                <p className="text-muted-foreground">Global player rankings coming soon.</p>
            </div>
        </div>
    )
}
