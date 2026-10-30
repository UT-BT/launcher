import { describe, expect, it, vi } from 'vitest'
import { iniIpcSchema } from './ini-schema'
import { parseIni } from '../handlers/ini-handler'

vi.mock('electron', () => ({ app: { getPath: () => '' } }))
vi.mock('@/lib/main/shared', () => ({ handle: vi.fn() }))
vi.mock('@/lib/main/config', () => ({ getUt99InstallPath: () => null }))
vi.mock('@/lib/main/logging-service', () => ({
    loggingService: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const sectionReturn = iniIpcSchema.readIniSection.return

describe('readIniSection return schema', () => {
    it('accepts a parsed section, duplicate keys as arrays', () => {
        const section = parseIni('[Engine.Input]\nSpace=Jump\nAliases=A\nAliases=B\n')['Engine.Input']
        const parsed = sectionReturn.parse(section)
        expect(parsed).toEqual({ Space: 'Jump', Aliases: ['A', 'B'] })
    })

    it('accepts a missing section', () => {
        expect(sectionReturn.parse(undefined)).toBeUndefined()
    })

    it('refuses values that are not strings or string lists', () => {
        expect(sectionReturn.safeParse({ Space: 1 }).success).toBe(false)
        expect(sectionReturn.safeParse({ Space: { nested: 'x' } }).success).toBe(false)
        expect(sectionReturn.safeParse('Jump').success).toBe(false)
    })
})
