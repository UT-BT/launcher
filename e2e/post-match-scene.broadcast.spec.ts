import { expect, test, type Page } from '@playwright/test'
import { STREAM_EVENT, STREAM_MATCH_ID, idleHotState, streamHotState } from '../app/components/stream/data/streamFixtures'
import {
    bracketConsequence,
    decidedMatch,
    inProgressMatch,
    nextMatch,
    officialMatch,
    officialRead,
    postMatchRead,
} from '../app/components/stream/scenes/postMatch/postMatchFixtures'
import { expectSceneScreenshot, openScene } from './streamHarness'

const READ_PATH = `/tournaments/${STREAM_EVENT.slug}/stream/matches/${STREAM_MATCH_ID}/post-match`
const PLAYOFFS = { key: 'playoffs', name: 'Playoff Stage' }

const UNOFFICIAL = streamHotState({ reason: 'current', match: decidedMatch() })
const OFFICIAL = streamHotState({ reason: 'current', match: officialMatch() })
const IN_PROGRESS = streamHotState({ reason: 'current', match: inProgressMatch() })
const QUARTER_FINAL = streamHotState({
    reason: 'current',
    match: officialMatch({ stage: PLAYOFFS, group: null, round: { no: 1, label: 'Quarter-final' } }),
})

const scene = (page: Page) => page.locator('[data-post-match]')

test('the live-decided result shows as unofficial with no consequence line', async ({ page }) => {
    await openScene(page, 'post-match', { hotState: UNOFFICIAL, reads: { [READ_PATH]: officialRead() } })

    await expect(scene(page)).toHaveAttribute('data-post-match', 'unofficial')
    await expect(page.locator('[data-post-match-winner]')).toHaveText('Crimson Cats')
    await expect(page.getByText('Live score · awaiting the admin result')).toBeVisible()
    await expect(page.locator('[data-series-map]')).toHaveCount(4)
    await expect(page.locator('[data-post-match-consequence]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'post-match-unofficial.png')
})

test('the official result drops the marker and shows the group consequence', async ({ page }) => {
    await openScene(page, 'post-match', { hotState: OFFICIAL, reads: { [READ_PATH]: officialRead() } })

    await expect(scene(page)).toHaveAttribute('data-post-match', 'official')
    await expect(page.getByText('Official result')).toBeVisible()
    await expect(page.getByText('Unofficial', { exact: true })).toHaveCount(0)
    const consequence = page.locator('[data-post-match-consequence]')
    await expect(consequence).toContainText('Crimson Cats: 2nd in Group B on 10 pts')
    await expect(consequence).toContainText('Azure Owls: 3rd in Group B on 6 pts')

    await expectSceneScreenshot(page, 'post-match-official.png')
})

test('a bracket loser reads as eliminated and the winner as advancing', async ({ page }) => {
    const consequence = bracketConsequence({ next_match: nextMatch(PLAYOFFS, 'Semi-final') }, {})
    await openScene(page, 'post-match', { hotState: QUARTER_FINAL, reads: { [READ_PATH]: officialRead(consequence) } })

    const line = page.locator('[data-post-match-consequence]')
    await expect(line).toContainText('Crimson Cats: Advances to the Semi-final')
    await expect(line).toContainText('Azure Owls: Eliminated')

    await expectSceneScreenshot(page, 'post-match-eliminated.png')
})

test('an undecided match shows a neutral in-progress state and no winner', async ({ page }) => {
    await openScene(page, 'post-match', { hotState: IN_PROGRESS })

    await expect(scene(page)).toHaveAttribute('data-post-match', 'in-progress')
    await expect(page.getByText('Match in progress')).toBeVisible()
    await expect(page.locator('[data-post-match-winner]')).toHaveCount(0)
    await expect(page.locator('[data-post-match-consequence]')).toHaveCount(0)
})

test('the result lands live, then turns official with its consequence, without a reload', async ({ page }) => {
    const api = await openScene(page, 'post-match', { hotState: IN_PROGRESS, reads: { [READ_PATH]: postMatchRead() } })
    await expect(scene(page)).toHaveAttribute('data-post-match', 'in-progress')
    await page.evaluate(() => { (window as unknown as { sameDocument: boolean }).sameDocument = true })

    api.setHotState(UNOFFICIAL)
    await expect(scene(page)).toHaveAttribute('data-post-match', 'unofficial')
    await expect(page.locator('[data-post-match-winner]')).toHaveText('Crimson Cats')

    api.setRead(READ_PATH, officialRead())
    api.setHotState(OFFICIAL)
    await expect(scene(page)).toHaveAttribute('data-post-match', 'official')
    await expect(page.locator('[data-post-match-consequence]')).toContainText('2nd in Group B on 10 pts')
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)).toBe(true)
})

test('the Post-match scene shows the idle frame when nothing is resolved', async ({ page }) => {
    await openScene(page, 'post-match', { hotState: idleHotState() })

    await expect(page.locator('[data-scene-idle]')).toHaveAttribute('data-stream-scene', 'post-match')
})
