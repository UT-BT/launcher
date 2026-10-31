import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

const sources = ['app', 'lib']
    .flatMap(dir => readdirSync(resolve(root, dir), { recursive: true, encoding: 'utf8' }).map(file => resolve(root, dir, file)))
    .filter(file => /\.tsx?$/.test(file) && !/\.(test\.tsx?|d\.ts)$/.test(file))
    .map(file => ({ path: relative(root, file).replace(/\\/g, '/'), text: readFileSync(file, 'utf8') }))

function filesMatching(pattern: RegExp, except: string): string[] {
    return sources.filter(source => source.path !== except && pattern.test(source.text)).map(source => source.path)
}

function sourceOf(path: string): string {
    const source = sources.find(entry => entry.path === path)
    if (!source) throw new Error(`missing source ${path}`)
    return source.text
}

describe('records definitions live in one place', () => {
    it('compares cap types only through app/utils/capTypes.ts', () => {
        expect(filesMatching(/cap_?[tT]ype\s*[!=]==?\s*\d|\d\s*[!=]==?\s*[\w.?]*cap_?[tT]ype\b/, 'app/utils/capTypes.ts')).toEqual([])
        expect(filesMatching(/\bcap_type:\s*\d/, 'app/utils/capTypes.ts')).toEqual([])
        expect(filesMatching(/const CAP_TYPE_\w+\s*=/, 'app/utils/capTypes.ts')).toEqual([])
    })

    it('defines the medal multipliers and their labels only in app/utils/medalThresholds.ts', () => {
        expect(filesMatching(/\b1\.025\b|\b1\.125\b/, 'app/utils/medalThresholds.ts')).toEqual([])
        expect(filesMatching(/'WR \+ \d/, 'app/utils/medalThresholds.ts')).toEqual([])
    })

    it('defines the difficulty tiers only in app/utils/difficulty.ts', () => {
        expect(filesMatching(/Beginner \(1/, 'app/utils/difficulty.ts')).toEqual([])
        expect(filesMatching(/'beginner':\s*return/, 'app/utils/difficulty.ts')).toEqual([])
    })

    it('resolves the map author name only in app/utils/mapAuthor.ts', () => {
        expect(filesMatching(/author_str\s*\?\?.*\.author\b|\.author\b.*\?\?.*author_str|function getAuthorString/, 'app/utils/mapAuthor.ts')).toEqual([])
    })

    it('labels team runs through teamRunStateLabel on every records surface', () => {
        const callSites = {
            'app/components/pages/TeamCapDetailPage.tsx': 1,
            'app/components/pages/capDetail/HeroSection.tsx': 1,
            'app/components/pages/mapDetail/LeaderboardCard.tsx': 2,
        }
        for (const [path, calls] of Object.entries(callSites)) {
            const text = sourceOf(path)
            expect(text.match(/teamRunStateLabel\(/g)?.length ?? 0, path).toBe(calls)
            expect(text, path).not.toMatch(/\?\s*'(Pending|Certified|Incomplete)'/)
        }
    })
})
