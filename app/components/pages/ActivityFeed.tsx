import { Clock, Trophy, UserPlus } from 'lucide-react'

const activities = [
    {
        id: 1,
        type: 'record',
        user: 'Player1',
        action: 'set a new record on',
        target: 'CTF-BT-MapName',
        time: '2 mins ago',
        icon: Trophy,
        color: 'text-yellow-500',
    },
    {
        id: 2,
        type: 'join',
        user: 'NewUser123',
        action: 'joined the community',
        target: '',
        time: '1 hour ago',
        icon: UserPlus,
        color: 'text-blue-500',
    },
    {
        id: 3,
        type: 'play',
        user: 'Player2',
        action: 'is playing on',
        target: 'UTBT Public Server #1',
        time: 'Now',
        icon: Clock,
        color: 'text-green-500',
    },
]

export function ActivityFeed() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">Activity Feed</h2>
            </div>

            <div className="grid gap-4">
                {activities.map((activity) => (
                    <div
                        key={activity.id}
                        className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 flex items-center gap-4 transition-all hover:bg-card/80"
                    >
                        <div className={`p-2 rounded-full bg-background border border-border ${activity.color}`}>
                            <activity.icon className="size-5" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm">
                                <span className="font-semibold text-foreground">{activity.user}</span>{' '}
                                <span className="text-muted-foreground">{activity.action}</span>{' '}
                                <span className="font-medium text-primary">{activity.target}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
