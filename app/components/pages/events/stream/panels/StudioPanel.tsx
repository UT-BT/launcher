import { BrbSection } from './studio/BrbSection'
import { CastersSection } from './studio/CastersSection'
import { WebcamSection } from './studio/WebcamSection'

export function StudioPanel() {
    return (
        <div className="space-y-4">
            <CastersSection />
            <BrbSection />
            <WebcamSection />
        </div>
    )
}
