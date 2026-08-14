import {
    fetchEvents,
    type BirthdayGreetingEmoji,
    type BirthdaySettings,
    type CalendarBirthday,
    type CalendarItem,
    type InboxNotification,
} from './api'

const BIRTHDAY_KEY = 'utbt:birthday-prototype:v1'
const GREETINGS_KEY = 'utbt:birthday-greetings-prototype:v3'
const INBOX_KEY = 'utbt:inbox-prototype:v1'
const INBOX_INITIALISED_KEY = 'utbt:inbox-prototype-initialised:v2'

const DEMO_BIRTHDAYS = [
    { day: 5, month: 8, user_id: '101010101010101010', alias: 'BunnyFan' },
    { day: 14, month: 8, user_id: '202020202020202020', alias: 'FastCapper' },
    { day: 22, month: 8, user_id: '303030303030303030', alias: 'MapExplorer' },
] as const

function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) as T : fallback
    } catch {
        return fallback
    }
}

function writeJson(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value))
}

export function getPrototypeBirthday(): BirthdaySettings | null {
    return readJson<BirthdaySettings | null>(BIRTHDAY_KEY, null)
}

export function setPrototypeBirthday(birthday: BirthdaySettings | null): BirthdaySettings | null {
    writeJson(BIRTHDAY_KEY, birthday)
    window.dispatchEvent(new CustomEvent('prototype-birthday-changed'))
    return birthday
}

function greetingKey(userId: string, date: string) {
    return `${userId}:${date}`
}

export async function fetchPrototypeCalendar(
    accessToken: string,
    currentUserId: string | null | undefined,
    currentAlias: string | null | undefined,
    from: string,
    to: string,
): Promise<CalendarItem[]> {
    const start = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T23:59:59`)
    const year = start.getFullYear()
    const greetings = readJson<Record<string, BirthdayGreetingEmoji>>(GREETINGS_KEY, {})
    const birthdays: CalendarBirthday[] = DEMO_BIRTHDAYS.map(person => ({
        type: 'birthday',
        date: `${year}-${String(person.month).padStart(2, '0')}-${String(person.day).padStart(2, '0')}`,
        user_id: person.user_id,
        alias: person.alias,
        greeting_emoji: greetings[greetingKey(person.user_id, `${year}-${String(person.month).padStart(2, '0')}-${String(person.day).padStart(2, '0')}`)] ?? null,
    })).filter(item => {
        const date = new Date(`${item.date}T12:00:00`)
        return date >= start && date <= end
    })

    const ownBirthday = getPrototypeBirthday()
    if (ownBirthday?.visible && currentUserId) {
        const date = `${year}-${String(ownBirthday.month).padStart(2, '0')}-${String(ownBirthday.day).padStart(2, '0')}`
        const occurrence = new Date(`${date}T12:00:00`)
        if (occurrence >= start && occurrence <= end) {
            birthdays.push({
                type: 'birthday',
                date,
                user_id: currentUserId,
                alias: currentAlias ?? 'You',
                greeting_emoji: null,
            })
        }
    }

    try {
        const events = await fetchEvents(accessToken)
        const calendarEvents: CalendarItem[] = events.flatMap(event => {
            if (!event.starts_at) return []
            const date = event.starts_at.slice(0, 10)
            return date >= from && date <= to ? [{ type: 'event' as const, date, event }] : []
        })
        return [...birthdays, ...calendarEvents]
    } catch {
        return birthdays
    }
}

export function sendPrototypeGreeting(birthday: CalendarBirthday, emoji: BirthdayGreetingEmoji): CalendarBirthday {
    const greetings = readJson<Record<string, BirthdayGreetingEmoji>>(GREETINGS_KEY, {})
    const key = greetingKey(birthday.user_id, birthday.date)
    greetings[key] = emoji
    writeJson(GREETINGS_KEY, greetings)
    return { ...birthday, greeting_emoji: emoji }
}

function ensurePrototypeInbox(): InboxNotification[] {
    if (localStorage.getItem(INBOX_INITIALISED_KEY)) return readJson<InboxNotification[]>(INBOX_KEY, [])
    const existing = readJson<InboxNotification[]>(INBOX_KEY, [])
    const notification: InboxNotification = {
        id: 'birthday-prototype-new-greeting-v2',
        type: 'birthday_greeting',
        actor_user_id: '505050505050505050',
        actor_alias: 'FlowerPower',
        emoji: '💐',
        created_at: new Date().toISOString(),
        read_at: null,
    }
    const seeded = existing.some(item => item.id === notification.id)
        ? existing
        : [notification, ...existing]
    writeJson(INBOX_KEY, seeded)
    localStorage.setItem(INBOX_INITIALISED_KEY, '1')
    return seeded
}

export function fetchPrototypeInbox(): InboxNotification[] {
    return ensurePrototypeInbox()
}

export function markPrototypeInboxRead(): InboxNotification[] {
    const readAt = new Date().toISOString()
    const items = ensurePrototypeInbox().map(item => item.read_at ? item : { ...item, read_at: readAt })
    writeJson(INBOX_KEY, items)
    return items
}

export function deletePrototypeNotification(id: string): InboxNotification[] {
    const items = ensurePrototypeInbox().filter(item => item.id !== id)
    writeJson(INBOX_KEY, items)
    return items
}
