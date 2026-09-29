import { StreamCard, StreamPlaceholder } from '../../StreamCard'

export function CurrentMatchSection() {
    return (
        <StreamCard title="Current match" description="Your assigned matches, the one your scenes show now, and the next match.">
            <StreamPlaceholder>Coming soon.</StreamPlaceholder>
        </StreamCard>
    )
}
