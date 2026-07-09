import { type TeamDetail, type TeamRole, type UserProfile } from '@/app/utils/api'
import { TeamHeaderCard } from './TeamHeaderCard'
import { MembersPanel } from './MembersPanel'
import { LineupsPanel } from './LineupsPanel'

interface MyTeamViewProps {
    accessToken: string
    team: TeamDetail
    myUserId?: string
    userProfile?: UserProfile
    onTeamChange: (team: TeamDetail) => void
    onLeftOrDisbanded: () => void
}

export function MyTeamView({
    accessToken, team, myUserId, userProfile, onTeamChange, onLeftOrDisbanded,
}: MyTeamViewProps) {
    const me = team.members.find(m => String(m.user) === String(myUserId))
    const myRole: TeamRole = me?.role ?? 'member'
    const isOwner = myRole === 'owner'
    const isManager = myRole === 'owner' || myRole === 'admin'

    return (
        <div className="space-y-4">
            <TeamHeaderCard
                accessToken={accessToken}
                team={team}
                isOwner={isOwner}
                isManager={isManager}
                userProfile={userProfile}
                onTeamChange={onTeamChange}
                onLeftOrDisbanded={onLeftOrDisbanded}
            />
            <div className="grid gap-4 lg:grid-cols-2 items-start">
                <MembersPanel
                    accessToken={accessToken}
                    team={team}
                    isOwner={isOwner}
                    isManager={isManager}
                    onTeamChange={onTeamChange}
                />
                <LineupsPanel
                    accessToken={accessToken}
                    team={team}
                    canManage={isManager}
                    onTeamChange={onTeamChange}
                />
            </div>
        </div>
    )
}
