const PRIVATE_KEY = /token|secret|password|passwd|e-?mail|hwid|hardware|machine_?id|mac_?address|fingerprint|cookie|api_?key|btpog|client_cap_delta|set_fps/i
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

export const EMAIL_REMOVED = '[email removed]'

function scrubText(text: string, addresses: Map<string, string>): string {
    return text
        .replace(EMAIL, EMAIL_REMOVED)
        .replace(IPV4, address => {
            if (!addresses.has(address)) addresses.set(address, `192.0.2.${addresses.size + 1}`)
            return addresses.get(address)!
        })
}

export type ShownField = (key: string) => boolean

function kept(key: string, shown: ShownField): boolean {
    return !PRIVATE_KEY.test(key) && (!FIELD_NAME.test(key) || shown(key))
}

function scrubValue(value: unknown, addresses: Map<string, string>, shown: ShownField): unknown {
    if (typeof value === 'string') return scrubText(value, addresses)
    if (Array.isArray(value)) return value.map(item => scrubValue(item, addresses, shown))
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([key, field]) => field !== undefined && kept(key, shown))
            .map(([key, field]) => [key, scrubValue(field, addresses, shown)]))
    }
    return value
}

export function scrubRecorded(body: unknown, addresses = new Map<string, string>(), shown: ShownField = () => true): unknown {
    return scrubValue(body, addresses, shown)
}
