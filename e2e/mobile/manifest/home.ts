import { HOME_RECORDS } from '../fixtures/home'
import type { MobileRouteEntry } from './types'

export const home: MobileRouteEntry = {
    view: 'home',
    tier: 'public',
    path: '/',
    fixtures: 'home',
    ready: async page => {
        await page.getByRole('heading', { name: 'Latest World Records' }).waitFor()
        await page.getByText(HOME_RECORDS[0].alias!, { exact: true }).first().waitFor()
    },
}
