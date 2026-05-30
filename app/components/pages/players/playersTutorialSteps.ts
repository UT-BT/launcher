import type React from 'react'
import type { TutorialStep } from '@/app/components/shared/Tutorial'

export type { TutorialStep }

export interface StepRefs {
    searchRef: React.RefObject<HTMLInputElement | null>
    columnsButtonRef: React.RefObject<HTMLButtonElement | null>
    sortHeaderRef: React.RefObject<HTMLButtonElement | null>
    firstRowPlayerRef: React.RefObject<HTMLElement | null>
}

export interface StepActions {
    setColumnsMenuOpen: (open: boolean) => void
}

const THEAD_SELECTOR = '[data-utbt-players-thead]'

export function buildSteps(refs: StepRefs, actions: StepActions): TutorialStep[] {
    return [
        {
            id: 'welcome',
            title: 'Welcome!',
            body: 'This is the Players page — browse everyone who plays on UTBT.\n\nUse the next and previous buttons to move around. Skip anytime.',
        },
        {
            id: 'search',
            title: 'Search',
            body: 'Type any part of a player\'s name to find them.',
            targetRef: refs.searchRef as React.RefObject<HTMLElement | null>,
        },
        {
            id: 'sort',
            title: 'Sort columns',
            body: 'Click any column header to sort by it — rank, points, medals, and more. Click again to reverse direction.\n\nThe list starts sorted by rank, best players first.',
            targetRef: refs.sortHeaderRef as React.RefObject<HTMLElement | null>,
            onEnter: () => {
                // Lift the sticky header above the tutorial dim overlay for this step.
                document.querySelector(THEAD_SELECTOR)?.classList.add('!z-[60]')
            },
            onExit: () => {
                document.querySelector(THEAD_SELECTOR)?.classList.remove('!z-[60]')
            },
        },
        {
            id: 'columns',
            title: 'Customise columns',
            body: 'Show extra stats like individual medal counts and join date, reorder columns with the drag handles, or hide what you don\'t need.',
            targetRef: refs.columnsButtonRef as React.RefObject<HTMLElement | null>,
            onEnter: () => actions.setColumnsMenuOpen(true),
            onExit: () => actions.setColumnsMenuOpen(false),
        },
        {
            id: 'profile',
            title: 'Open a profile',
            body: 'Click any player to open their full profile — records, medals, playtime, and more.',
            targetRef: refs.firstRowPlayerRef,
        },
        {
            id: 'done',
            title: 'All set',
            body: 'That\'s the tutorial. You can reopen it any time using the (?) icon in the top right corner.',
            onEnter: () => actions.setColumnsMenuOpen(false),
        },
    ]
}
