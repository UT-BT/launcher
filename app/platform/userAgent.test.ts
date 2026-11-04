import { describe, expect, it } from 'vitest'
import { canRunDesktopInstaller, userAgentOs } from './userAgent'

const USER_AGENTS = [
    {
        name: 'Windows 10 Chrome',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        os: 'windows',
        installer: true,
    },
    {
        name: 'Windows 11 Edge',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        os: 'windows',
        installer: true,
    },
    {
        name: 'Windows 10 Firefox',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
        os: 'windows',
        installer: true,
    },
    {
        name: 'Windows on ARM Firefox',
        ua: 'Mozilla/5.0 (Windows NT 10.0; ARM64; rv:132.0) Gecko/20100101 Firefox/132.0',
        os: 'windows',
        installer: true,
    },
    {
        name: 'Windows tablet Edge',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Touch) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        os: 'windows',
        installer: true,
    },
    {
        name: 'a later Windows NT version',
        ua: 'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        os: 'windows',
        installer: true,
    },
    {
        name: 'Windows 7 Chrome',
        ua: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        os: 'windows',
        installer: false,
    },
    {
        name: 'Windows 8.1 Firefox',
        ua: 'Mozilla/5.0 (Windows NT 6.3; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
        os: 'windows',
        installer: false,
    },
    {
        name: 'Windows Phone',
        ua: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15063',
        os: 'windows',
        installer: false,
    },
    {
        name: 'Windows Phone reporting Windows NT 10.0',
        ua: 'Mozilla/5.0 (Windows NT 10.0; ARM; Lumia 950; Windows Phone 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15063',
        os: 'windows',
        installer: false,
    },
    {
        name: 'Windows Mobile reporting Windows NT 10.0',
        ua: 'Mozilla/5.0 (Windows NT 10.0; ARM; Windows Mobile 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15063',
        os: 'windows',
        installer: false,
    },
    {
        name: 'Android',
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        os: 'android',
        installer: false,
    },
    {
        name: 'iPhone',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        os: 'ios',
        installer: false,
    },
    {
        name: 'iPad in desktop mode',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        os: 'macos',
        installer: false,
    },
    {
        name: 'macOS Chrome',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        os: 'macos',
        installer: false,
    },
    {
        name: 'Linux Firefox',
        ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
        os: 'linux',
        installer: false,
    },
    {
        name: 'ChromeOS',
        ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        os: 'chromeos',
        installer: false,
    },
    {
        name: 'an empty user agent',
        ua: '',
        os: 'unknown',
        installer: false,
    },
]

describe('userAgentOs', () => {
    it.each(USER_AGENTS)('buckets $name as $os', ({ ua, os }) => {
        expect(userAgentOs(ua)).toBe(os)
    })
})

describe('canRunDesktopInstaller', () => {
    it.each(USER_AGENTS)('$name: $installer', ({ ua, installer }) => {
        expect(canRunDesktopInstaller(ua)).toBe(installer)
    })
})
