import type React from 'react'
import type { TutorialStep } from '@/app/components/shared/Tutorial'

export type { TutorialStep }

export interface StepRefs {
    filtersButtonRef: React.RefObject<HTMLButtonElement | null>
    columnsButtonRef: React.RefObject<HTMLButtonElement | null>
    presetsButtonRef: React.RefObject<HTMLButtonElement | null>
    sortHeaderRef: React.RefObject<HTMLButtonElement | null>
    firstRowFavRef: React.RefObject<HTMLElement | null>
    firstRowPlayersRef: React.RefObject<HTMLElement | null>
    firstRowSpectatorsRef: React.RefObject<HTMLElement | null>
    firstRowStatusRef: React.RefObject<HTMLElement | null>
    firstRowJoinRef: React.RefObject<HTMLElement | null>
}

export interface StepActions {
    openFilterPanel: () => void
    closeFilterPanel: () => void
    setPresetsMenuOpen: (open: boolean) => void
    setColumnsMenuOpen: (open: boolean) => void
}

export function buildSteps(refs: StepRefs, actions: StepActions): TutorialStep[] {
    return [
        {
            id: 'welcome',
            title: 'Welcome!',
            body: 'Quick tour of the server browser.\n\nUse Next / Prev to move, or Skip to dismiss.',
        },
        {
            id: 'filters',
            title: 'Filter the list',
            body: 'Narrow by type (Certified / Duel / Casual), region, capacity, or your favorites.\n\nThe badge shows how many filters are active.',
            targetRef: refs.filtersButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: actions.openFilterPanel,
        },
        {
            id: 'presets',
            title: 'Saved filter presets',
            body: 'Save filter combinations you use often (e.g. "EU Certified only") and load them with one click.',
            targetRef: refs.presetsButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: () => {
                actions.openFilterPanel()
                actions.setPresetsMenuOpen(true)
            },
            onExit: () => actions.setPresetsMenuOpen(false),
        },
        {
            id: 'columns',
            title: 'Customise columns',
            body: 'Show / hide columns and drag the handles to reorder. Set the table up however you like.',
            targetRef: refs.columnsButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: () => {
                actions.setPresetsMenuOpen(false)
                actions.closeFilterPanel()
                actions.setColumnsMenuOpen(true)
            },
            onExit: () => actions.setColumnsMenuOpen(false),
        },
        {
            id: 'sort',
            title: 'Sort columns',
            body: 'Click any column header to sort by that column. Click again to flip direction.',
            targetRef: refs.sortHeaderRef as React.RefObject<HTMLElement | null>,
            onEnter: () => {
                document.querySelector('[data-utbt-servers-thead]')?.classList.add('!z-[60]')
            },
            onExit: () => {
                document.querySelector('[data-utbt-servers-thead]')?.classList.remove('!z-[60]')
            },
        },
        {
            id: 'favorites',
            title: 'Favorite servers',
            body: 'Star a server to favorite it. Combine with the Favorites-only filter to see just your saved servers.',
            targetRef: refs.firstRowFavRef,
        },
        {
            id: 'players',
            title: 'Who is playing',
            body: 'Avatar stack shows who is currently on the server. Click it to see the full player list with pings.',
            targetRef: refs.firstRowPlayersRef,
        },
        {
            id: 'spectators',
            title: 'Who is spectating',
            body: 'Same idea for spectators. The UTBT Spectator Bot streams matches live on Twitch — click it to watch.',
            targetRef: refs.firstRowSpectatorsRef,
        },
        {
            id: 'status',
            title: 'Match status',
            body: 'Time remaining in the current match, or Overtime / Match Ended when the round is done.',
            targetRef: refs.firstRowStatusRef,
        },
        {
            id: 'join',
            title: 'Join or spectate',
            body: 'Hit Join to play, or Spec to spectate without taking a player slot.\n\nLauncher will configure your INI and launch the game automatically.',
            targetRef: refs.firstRowJoinRef,
        },
        {
            id: 'done',
            title: 'All set',
            body: 'That\'s it! Reopen the tutorial any time using the (?) icon in the top right.',
            onEnter: () => {
                actions.setPresetsMenuOpen(false)
                actions.setColumnsMenuOpen(false)
                actions.closeFilterPanel()
            },
        },
    ]
}
