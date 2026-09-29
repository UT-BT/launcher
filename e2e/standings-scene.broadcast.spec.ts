import { expect, test, type Page } from '@playwright/test'
import type { EventBracket } from '../app/utils/api'
import type { StreamHotState } from '../app/components/stream/data/streamHotState'
import { STREAM_MATCH_ID, idleHotState } from '../app/components/stream/data/streamFixtures'
import type { StandingsRead } from '../app/components/stream/scenes/standings/standingsRead'
import {
    TEAM_A, TEAM_B, bracketHotState, bracketStage, groupHotState, groupStage, largeBracketStage, standingsFormat, standingsRead,
    swissHotState, swissStage,
} from '../app/components/stream/scenes/standings/standingsFixtures'
import { SCENE_SLUG, expectSceneScreenshot, openScene } from './streamHarness'

const BRACKET: EventBracket = { published: true, format: { template: null, spec: standingsFormat() }, stages: [] }
const BRACKET_PATH = `/tournaments/${SCENE_SLUG}/bracket`
const STANDINGS_PATH = `/tournaments/${SCENE_SLUG}/stream/matches/${STREAM_MATCH_ID}/standings`

function openStandings(page: Page, hotState: StreamHotState, read: StandingsRead | null, query?: string) {
    const reads: { [path: string]: object } = { [BRACKET_PATH]: BRACKET }
    if (read) reads[STANDINGS_PATH] = read
    return openScene(page, 'standings', { hotState, reads, query })
}

test('the Standings scene shows the match group table with both teams highlighted', async ({ page }) => {
    await openStandings(page, groupHotState(), standingsRead(groupStage(), { group_id: 'group-b' }))

    const scene = page.locator('[data-stream-scene="standings"]')
    await expect(scene.locator('[data-standings-kind="groups"]')).toBeVisible()
    await expect(scene.locator(`[data-standings-row="${TEAM_A.id}"]`)).toHaveAttribute('data-side', 'a')
    await expect(scene.locator(`[data-standings-row="${TEAM_B.id}"]`)).toHaveAttribute('data-side', 'b')
    await expect(scene.locator('[data-standings-row][data-side]')).toHaveCount(2)
    await expect(scene.getByText('1st–2nd · Final Stage')).toBeVisible()
    await expect(scene.getByText('Group B · after round 4 so far')).toBeVisible()

    await expectSceneScreenshot(page, 'standings-groups.png')
})

test('the Standings scene shows the Swiss records around the match bucket', async ({ page }) => {
    await openStandings(page, swissHotState(), standingsRead(swissStage()))

    const scene = page.locator('[data-standings-kind="swiss"]')
    await expect(scene).toBeVisible()
    await expect(scene.locator(`[data-swiss-pairing="${STREAM_MATCH_ID}"] [data-side]`)).toHaveCount(2)
    await expect(scene.getByText('Round 3 · winners qualify, losers are out')).toBeVisible()

    await expectSceneScreenshot(page, 'standings-swiss.png')
})

test('the Standings scene shows the elimination bracket with the match and its path', async ({ page }) => {
    await openStandings(page, bracketHotState(), standingsRead(bracketStage()))

    const scene = page.locator('[data-standings-kind="bracket"]')
    await expect(scene).toBeVisible()
    await expect(scene.locator(`[data-bracket-match="${STREAM_MATCH_ID}"]`)).toContainText('Live · this match')
    await expect(scene.locator('[data-bracket-match="sf-1"]')).toContainText('Winner goes here')
    await expect(scene.locator('[data-bracket-match="r1-b1"]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'standings-bracket.png')
})

test('a large bracket shows the teams half of it, inside the frame', async ({ page }) => {
    await openStandings(page, bracketHotState(), standingsRead(largeBracketStage()))

    const scene = page.locator('[data-standings-kind="bracket"]')
    await expect(scene).toHaveAttribute('data-bracket-region', 'true')
    await expect(scene.locator('[data-bracket-match]')).toHaveCount(8)
    await expect(scene.getByText(/Their half of the bracket/)).toBeVisible()

    const boxes = await scene.locator('[data-bracket-match]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().bottom))
    expect(Math.max(...boxes)).toBeLessThanOrEqual(1016)
})

test('the Standings scene plays no sound and runs no animation with sound=0, a volume and motion=0', async ({ page }) => {
    await openStandings(page, groupHotState(), standingsRead(groupStage(), { group_id: 'group-b' }), 'sound=0&volume=40&motion=0')

    await expect(page.locator('[data-standings-kind="groups"]')).toBeVisible()
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
    await expect(page.locator('audio')).toHaveCount(0)
})

test('the Standings scene shows the idle frame when nothing is resolved', async ({ page }) => {
    await openStandings(page, idleHotState(), null)

    await expect(page.locator('[data-scene-idle]')).toHaveAttribute('data-stream-scene', 'standings')
})
