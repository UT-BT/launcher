import { StreamCard, StreamPlaceholder } from '../StreamCard'

export function ChannelPanel() {
    return (
        <StreamCard title="Channel" description="Where this match streams, and your own Twitch channel.">
            <StreamPlaceholder>Coming soon.</StreamPlaceholder>
        </StreamCard>
    )
}
