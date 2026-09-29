import { Suspense, lazy } from 'react'
import { StreamLoading } from '../StreamCard'
import { MATCH_SECTIONS } from './match/matchSections'

const SECTIONS = MATCH_SECTIONS.map(section => ({ ...section, Component: lazy(section.load) }))

export function MatchPanel() {
    return (
        <div className="grid gap-4 2xl:grid-cols-2">
            {SECTIONS.map(({ id, label, Component }) => (
                <Suspense key={id} fallback={<StreamLoading label={label} />}>
                    <Component />
                </Suspense>
            ))}
        </div>
    )
}
