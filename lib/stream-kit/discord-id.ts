const DISCORD_ID = /^\d{17,20}$/

export function isDiscordId(value: string | null | undefined): value is string {
    return typeof value === 'string' && DISCORD_ID.test(value)
}
