import { Map as MapIcon } from 'lucide-react'

export function MapSearch() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
            <div className="p-4 rounded-full bg-muted">
                <MapIcon className="size-8 text-muted-foreground" />
            </div>
            <div>
                <h2 className="text-2xl font-bold">Map Search</h2>
                <p className="text-muted-foreground">Search and download maps directly from the launcher.</p>
            </div>
        </div>
    )
}
