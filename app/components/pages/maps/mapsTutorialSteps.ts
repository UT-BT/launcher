import type React from 'react'

export interface TutorialStep {
    id: string
    title: string
    body: React.ReactNode
    targetRef?: React.RefObject<HTMLElement | null>
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
    firstRowReplayRef: React.RefObject<HTMLButtonElement | null>
    firstRowRatingRef: React.RefObject<HTMLButtonElement | null>
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
            body: 'Let\'ts get started with the tutorial! Use the next and previous buttons to move around. Skip anytime.',
        },
        {
            id: 'search',
            title: 'Search',
            body: 'Type any part of a map name to filter the list instantly.',
            targetRef: refs.searchRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'filters-button',
            title: 'Filters',
            body: 'Open the filter panel to narrow maps by attributes, ratings, capped status, and more. The badge shows how many filters are active.',
            targetRef: refs.filtersButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: actions.openFilterPanel,
        },
        {
            id: 'filter-categories',
            title: 'Filter categories',
            body: 'Filters let you find you specific maps. You can combine as many as you like. These filters persist until you clear them, even if you leave and come back later.',
            targetRef: refs.filterPanelRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'presets',
            title: 'Saved filter presets',
            body: 'Got a combination of filters you use often? Save it as a preset for easy access anytime.',
            targetRef: refs.presetsButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: () => actions.setPresetsMenuOpen(true),
            onExit: () => actions.setPresetsMenuOpen(false),
        },
        {
            id: 'columns',
            title: 'Customise columns',
            body: 'Drag handles to reorder columns. Checkboxes hide columns you do not need.',
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
        },
        {
            id: 'favorites',
            title: 'Favorite maps',
            body: 'Star a map to favorite it. Favorites sync to the cloud and to your game automatically. Favorites made in game will show up here too and sync to the cloud.',
            targetRef: refs.firstRowFavRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'replay',
            title: 'Watch replays',
            body: 'Use the replay button to watch the run on this map. \n\nYou can also click the World Record time itself to jump straight to the world record run.',
            targetRef: refs.firstRowReplayRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'pb',
            title: 'Watch your own runs',
            body: 'Click your Personal Best time to watch your own run. \n\nOnly works for verified caps (those set on a certified server).',
            targetRef: refs.firstRowPbRef,
        },
        {
            id: 'ratings',
            title: 'Map ratings',
            body: 'Community Rating shows the average community score for this map. Click to see and set a rating.',
            targetRef: refs.firstRowRatingRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'done',
            title: 'All set',
            body: 'That’s the tutorial. You can reopen it any time using the (?) icon next to the Maps heading.',
            onEnter: () => {
                actions.setPresetsMenuOpen(false)
                actions.setColumnsMenuOpen(false)
                actions.closeFilterPanel()
            },
        },
    ]
}
