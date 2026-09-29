import { BrbSection } from './show/BrbSection'
import { CastersSection } from './show/CastersSection'
import { WebcamSection } from './show/WebcamSection'

export function ShowPanel() {
    return (
        <div className="space-y-4">
            <BrbSection />
            <CastersSection />
            <WebcamSection />
        </div>
    )
}
