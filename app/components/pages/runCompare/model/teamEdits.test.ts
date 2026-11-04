import { describe, expect, it } from 'vitest'
import { holdWhileAdding } from './addRuns'
import { editableSet, editSet, LAST_RUN, TEAM_LIMIT_REACHED, type SetEdit } from './setEdits'
import { composeTeams, INDUSTRY, testTeam } from './teamTestRuns'

const A = INDUSTRY.teamCapId
const [GIORGIO, KRAD, PATRIK] = INDUSTRY.members.map(run => run.capId)
const OTHERS = [testTeam(1, 70), testTeam(2, 71), testTeam(3, 72), testTeam(4, 73)]
const [B, C, D, E] = OTHERS.map(team => team.teamCapId)
const TEAMS = [INDUSTRY, ...OTHERS]

function edit(query: string, change: SetEdit) {
    return editSet(editableSet(composeTeams(query, TEAMS)), change)
}

describe('editing a set of team runs', () => {
    it('adds a team run, and blocks a fifth one with the explanation', () => {
        expect(edit(`runs=${A}`, { kind: 'add', capId: B })).toEqual({ query: `runs=${A},${B}`, blocked: null })
        expect(edit(`runs=${A},${B},${C},${D}`, { kind: 'add', capId: E })).toEqual({ query: null, blocked: TEAM_LIMIT_REACHED })
        expect(TEAM_LIMIT_REACHED).toBe('A comparison holds at most 4 team runs. Remove one before adding another.')
    })

    it('removes the whole team run from a member, with its members\' data-only, offset, pairing and driving entries', () => {
        const [b1, b2] = OTHERS[0].members.map(run => run.capId)
        const query = `runs=${A},${B}&ref=${B}&data=${GIORGIO},${b1}&off=${b2}:120,${PATRIK}:40&pair=${b1}:${KRAD}&drive=${b1}`
        expect(edit(query, { kind: 'remove', capId: b2 }).query).toBe(`runs=${A}&data=${GIORGIO}&off=${PATRIK}:40`)
        expect(edit(query, { kind: 'remove', capId: B }).query).toBe(`runs=${A}&data=${GIORGIO}&off=${PATRIK}:40`)
    })

    it('never removes the last team run', () => {
        expect(edit(`runs=${A}`, { kind: 'remove', capId: KRAD })).toEqual({ query: null, blocked: LAST_RUN })
    })

    it('pins one team run as the reference, from the team or one of its members, and unpins it', () => {
        const [b1] = OTHERS[0].members.map(run => run.capId)
        expect(edit(`runs=${A},${B}`, { kind: 'pin', capId: b1 }).query).toBe(`runs=${A},${B}&ref=${B}`)
        expect(edit(`runs=${A},${B}&ref=${B}`, { kind: 'pin', capId: A }).query).toBe(`runs=${A},${B}&ref=${A}`)
        expect(edit(`runs=${A},${B}&ref=${B}`, { kind: 'unpin', capId: b1 }).query).toBe(`runs=${A},${B}`)
    })

    it('hides and shows a single member POV', () => {
        expect(edit(`runs=${A}`, { kind: 'video', capId: KRAD, on: false }).query).toBe(`runs=${A}&data=${KRAD}`)
        expect(edit(`runs=${A}&data=${KRAD}`, { kind: 'video', capId: KRAD, on: true }).query).toBe(`runs=${A}`)
    })
})

describe('keeping the stage while an added team run loads', () => {
    it('holds the settled team set while the new team run is read', () => {
        const settled = composeTeams(`runs=${A}`, TEAMS)
        const loading = composeTeams(`runs=${A},${B}`, [INDUSTRY], { teams: new Map([[A, INDUSTRY]]) })

        expect(loading.loading).toBe(true)
        const held = holdWhileAdding(loading, settled)
        expect(held.loading).toBe(false)
        expect(held.teams.rows.map(row => row.teamCapId)).toEqual([A])
        expect(held.query).toBe(`runs=${A},${B}`)
    })
})
