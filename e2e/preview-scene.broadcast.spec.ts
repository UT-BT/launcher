import { expect, test } from '@playwright/test'
import { STREAM_EVENT, idleHotState, streamHotState, streamMatch } from '../app/components/stream/data/streamFixtures'
import {
    eliminationStageView,
    previewTeam,
    streamPreview,
    swissStageView,
} from '../app/components/stream/scenes/preview/previewFixtures'
import { SCENE_SLUG, expectSceneScreenshot, openScene, scenePath } from './streamHarness'

function previewPath(matchId: string): string {
    return `/tournaments/${SCENE_SLUG}/stream/matches/${matchId}/preview`
}

const GROUP_STATE = streamHotState()
const GROUP_PREVIEW = streamPreview()

const ELIMINATION_MATCH = {
    stage: { key: 'final', name: 'Final Stage' },
    group: null,
    round: { no: 2, label: 'Quarter-finals' },
}
const ELIMINATION_STATE = streamHotState({ match: streamMatch(ELIMINATION_MATCH) })
const ELIMINATION_PREVIEW = streamPreview({
    match: { ...GROUP_PREVIEW.match, ...ELIMINATION_MATCH, stage: { ...ELIMINATION_MATCH.stage, kind: 'single_elim' } },
    stage_view: eliminationStageView(),
    predictions_enabled: false,
    odds: null,
})

test('the Match Preview shows both lineups, the group table, head-to-head and odds in a group stage', async ({ page }) => {
    await openScene(page, 'preview', { hotState: GROUP_STATE, reads: { [previewPath('match-1')]: GROUP_PREVIEW } })

    const scene = page.locator('[data-stream-scene="preview"]')
    await expect(scene.locator('[data-preview-match="match-1"]')).toBeVisible()
    await expect(scene.getByRole('heading', { level: 1, name: 'Match preview' })).toBeVisible()
    await expect(scene.getByText('20:00 UTC · in 1h 20m')).toBeVisible()
    await expect(scene.getByText(STREAM_EVENT.name)).toBeVisible()

    const teamA = scene.locator('[data-preview-team="a"]')
    await expect(teamA.getByRole('heading', { level: 2, name: 'Crimson Cats' })).toBeVisible()
    await expect(teamA.getByText('Stage seed 2')).toBeVisible()
    await expect(teamA.getByText('Pre-cup seed 5')).toBeVisible()
    await expect(teamA.getByText('58% · 1.72')).toBeVisible()
    await expect(teamA.getByText('1,284')).toBeVisible()
    await expect(teamA.getByText('17 solo · 6 team')).toBeVisible()
    await expect(teamA.getByRole('img', { name: 'Ada' })).toBeVisible()
    await expect(scene.locator('[data-preview-team="b"]').getByText('Cap Machine')).toHaveCount(0)
    await expect(scene.locator('[data-preview-team="b"]').getByText('World Record Holder')).toBeVisible()

    await expect(scene.locator('[data-preview-stage="groups"]')).toHaveText('Group B standings')
    await expect(scene.locator('[data-preview-row="a"]')).toContainText('Crimson Cats')
    await expect(scene.locator('[data-preview-row="b"]')).toContainText('Azure Owls')
    await expect(scene.locator('[data-preview-h2h]')).toContainText('Azure Owls won 3–1')
    await expect(scene.locator('[data-preview-odds]')).toContainText('2.38')

    await expectSceneScreenshot(page, 'preview-group.png')
})

test('the Match Preview shows the bracket path in an elimination stage and hides odds without predictions', async ({ page }) => {
    await openScene(page, 'preview', { hotState: ELIMINATION_STATE, reads: { [previewPath('match-1')]: ELIMINATION_PREVIEW } })

    const scene = page.locator('[data-stream-scene="preview"]')
    await expect(scene.locator('[data-preview-stage="single_elim"]')).toHaveText('Final Stage · Bracket path')
    await expect(scene.getByText('Final Stage · Quarter-finals')).toBeVisible()
    await expect(scene.getByText('This match')).toHaveCount(2)
    await expect(scene.getByText('Winner goes to')).toBeVisible()
    await expect(scene.getByText('vs Warp Rabbits')).toBeVisible()
    await expect(scene.locator('[data-preview-odds]')).toHaveCount(0)
    await expect(scene.getByText('58% · 1.72')).toHaveCount(0)

    await expectSceneScreenshot(page, 'preview-elimination.png')
})

test('the Match Preview shows the Swiss record in a Swiss stage', async ({ page }) => {
    const preview = streamPreview({ stage_view: swissStageView() })
    await openScene(page, 'preview', { hotState: GROUP_STATE, reads: { [previewPath('match-1')]: preview } })

    const scene = page.locator('[data-stream-scene="preview"]')
    await expect(scene.locator('[data-preview-stage="swiss"]')).toContainText('Playoff Stage · Swiss')
    await expect(scene.getByText('Round 3 · 2 wins qualify · 2 losses out')).toBeVisible()
    await expect(scene.getByText('Qualified')).toBeVisible()
    await expect(scene.getByText('4 teams')).toBeVisible()
})

test('the Match Preview follows the resolved match without a reload and falls back to the idle frame', async ({ page }) => {
    const second = streamPreview({ teams: { a: previewTeam('a', { name: 'Golden Geese' }), b: previewTeam('b') } })
    const api = await openScene(page, 'preview', {
        hotState: GROUP_STATE,
        reads: { [previewPath('match-1')]: GROUP_PREVIEW, [previewPath('match-2')]: second },
    })
    await expect(page.locator('[data-preview-match="match-1"]')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { sameDocument: boolean }).sameDocument = true })

    api.setHotState(streamHotState({ match: streamMatch({ id: 'match-2' }) }))
    await expect(page.locator('[data-preview-match="match-2"]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Golden Geese' })).toBeVisible()

    api.setHotState(idleHotState())
    await expect(page.locator('[data-scene-idle]')).toHaveAttribute('data-stream-scene', 'preview')
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)).toBe(true)
})

test('the Match Preview keeps the frame up while its read is unavailable', async ({ page }) => {
    await openScene(page, 'preview', { hotState: GROUP_STATE })

    const scene = page.locator('[data-stream-scene="preview"]')
    await expect(scene.getByRole('heading', { level: 1, name: 'Match preview' })).toBeVisible()
    await expect(scene.locator('[data-preview-match]')).toHaveCount(0)
})

test('the Match Preview honours motion=0 and the sound options', async ({ page }) => {
    await openScene(page, 'preview', { hotState: GROUP_STATE, reads: { [previewPath('match-1')]: GROUP_PREVIEW } })
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'off')
    await expect(page.locator('[data-preview-match="match-1"]')).toBeVisible()

    await page.goto(scenePath('preview', 'volume=40'))
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'on')
    await expect(page.locator('[data-preview-team="a"]').getByRole('heading', { level: 2, name: 'Crimson Cats' })).toBeVisible()
})
