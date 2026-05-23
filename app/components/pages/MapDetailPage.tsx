import { ArrowLeft, Map } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { UserProfile } from '@/app/utils/api'

interface MapDetailPageProps {
    mapName: string
    onBack: () => void
    userProfile?: UserProfile
}

export function MapDetailPage({ mapName, onBack }: MapDetailPageProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-white -ml-2">
                    <ArrowLeft className="size-4 mr-1" />
                    Maps
                </Button>
            </div>

            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="p-4 rounded-full bg-white/5 border border-white/10">
                    <Map className="size-10 text-muted-foreground" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{mapName}</h2>
                    <p className="text-muted-foreground mt-1">Map detail page coming soon.</p>
                </div>
            </div>
        </div>
    )
}
