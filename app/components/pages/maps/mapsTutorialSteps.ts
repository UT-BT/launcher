import type React from 'react'

export interface TutorialStep {
    id: string
    title: string
    body: React.ReactNode
    targetRef?: React.RefObject<HTMLElement | null>
    targetRefs?: React.RefObject<HTMLElement | null>[]
    onEnter?: () => void
    onExit?: () => void
}

export interface StepRefs {
    searchRef: React.RefObject<HTMLInputElement | null>
    filtersButtonRef: React.RefObject<HTMLButtonElement | null>
    filterPanelRef: React.RefObject<HTMLDivElement | null>
    columnsButtonRef: React.RefObject<HTMLButtonElement | null>
    presetsButtonRef: React.RefObject<HTMLButtonElement | null>
    sortHeaderRef: React.RefObject<HTMLButtonElement | null>
    firstRowFavRef: React.RefObject<HTMLSpanElement | null>
    firstRowWrRef: React.RefObject<HTMLButtonElement | null>
    firstRowReplayRef: React.RefObject<HTMLButtonElement | null>
    firstRowRatingRef: React.RefObject<HTMLButtonElement | null>
    firstRowMyRatingRef: React.RefObject<HTMLButtonElement | null>
    firstRowNameRef: React.RefObject<HTMLButtonElement | null>
    firstRowPbRef: React.RefObject<HTMLElement | null>
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
            body: 'Let\'s get started with the tutorial!\n\nUse the next and previous buttons to move around. Skip anytime.',
        },
        {
            id: 'search',
            title: 'Search',
            body: 'Type any part of a map name to filter the list.',
            targetRef: refs.searchRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'filters-button',
            title: 'Filters',
            body: 'Open the filter section to narrow maps by attributes, ratings, capped status, and more.\n\nThe badge shows how many filters are active.',
            targetRef: refs.filtersButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: actions.openFilterPanel,
        },
        {
            id: 'presets',
            title: 'Saved filter presets',
            body: 'Got a combination of filters you use often? Save it as a preset for easy access anytime.',
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
            body: 'Customise the table just how you like it.\n\nDrag handles to reorder columns, and checkboxes hide columns you do not want.',
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
            body: 'Click any column header to sort by that column. Click again to reverse direction.',
            targetRef: refs.sortHeaderRef as React.RefObject<HTMLElement | null>,
            onEnter: () => {
                // Lift the table header above the tutorial dim overlay for this step.
                document.querySelector('[data-utbt-maps-thead]')?.classList.add('!z-[60]')
            },
            onExit: () => {
                document.querySelector('[data-utbt-maps-thead]')?.classList.remove('!z-[60]')
            },
        },
        {
            id: 'favorites',
            title: 'Favorite maps',
            body: 'Star a map to favorite it. Favorites sync to the cloud and to your game automatically. Favorites made in game will show up here too and sync to the cloud.',
            targetRef: refs.firstRowFavRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'world-record',
            title: 'Watch the world record',
            body: 'Click the World Record time to watch the replay of the current world record run.',
            targetRef: refs.firstRowWrRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'pb',
            title: 'Watch your own runs',
            body: 'Click your Personal Best time to watch the replay of your own run. \n\nOnly works for verified caps (those set on a certified server).',
            targetRef: refs.firstRowPbRef,
        },
        {
            id: 'replay',
            title: 'Watch demos',
            body: 'Use the demos button to browse and watch every recorded run on this map, or to download a specific demo.',
            targetRef: refs.firstRowReplayRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'ratings',
            title: 'Map ratings',
            body: 'This shows the community and your personal rating for a map. \n\nClick either to view/change/update a review for this map.',
            targetRefs: [
                refs.firstRowRatingRef as React.RefObject<HTMLElement | null>,
                refs.firstRowMyRatingRef as React.RefObject<HTMLElement | null>,
            ],
            onEnter: () => {
                // Lift the table header above the tutorial dim overlay for this step.
                document.querySelector('[data-utbt-maps-thead]')?.classList.add('!z-[60]')
            },
            onExit: () => {
                document.querySelector('[data-utbt-maps-thead]')?.classList.remove('!z-[60]')
            },
        },
        {
            id: 'done',
            title: 'All set',
            body: 'That’s the tutorial. You can reopen it any time using the (?) icon in the top right corner.',
            onEnter: () => {
                actions.setPresetsMenuOpen(false)
                actions.setColumnsMenuOpen(false)
                actions.closeFilterPanel()
            },
        },
    ]
}
