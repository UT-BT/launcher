import { ArrowLeft, User } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { UserProfile, getAvatarUrl } from '@/app/utils/api'

interface PlayerDetailPageProps {
    userId: string | number
    onBack: () => void
    userProfile?: UserProfile
}

export function PlayerDetailPage({ userId, onBack }: PlayerDetailPageProps) {
    const fallback = `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-white -ml-2">
                    <ArrowLeft className="size-4 mr-1" />
                    Back
                </Button>
            </div>

            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                {String(userId).length > 5 ? (
                    <img
                        src={getAvatarUrl(userId)}
                        alt={String(userId)}
                        className="size-24 rounded-full object-cover border border-white/10"
                        onError={e => { (e.target as HTMLImageElement).src = fallback }}
                    />
                ) : (
                    <div className="p-4 rounded-full bg-white/5 border border-white/10">
                        <User className="size-10 text-muted-foreground" />
                    </div>
                )}
                <div>
                    <h2 className="text-xl font-bold text-white">Player {userId}</h2>
                    <p className="text-muted-foreground mt-1">Player detail page coming soon.</p>
                </div>
            </div>
        </div>
    )
}
