import { OwnTwitchSection } from './channel/OwnTwitchSection'
import { KitSection } from './KitSection'
import { ScenesSection } from './ScenesSection'

export function SetupPanel() {
    return (
        <div className="space-y-4">
            <OwnTwitchSection />
            <KitSection />
            <ScenesSection />
        </div>
    )
}
