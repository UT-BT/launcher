import errorAlreadyChosen from './pickBanVeto/error_already_chosen.json'
import errorSideLocked from './pickBanVeto/error_side_locked.json'
import errorVetoChoiceActive from './pickBanVeto/error_veto_choice_active.json'
import errorVetoNotOpen from './pickBanVeto/error_veto_not_open.json'
import pickBanConfig from './pickBanVeto/pick_ban_config.json'
import pickBanDirectQualifier from './pickBanVeto/pick_ban_direct_qualifier.json'
import pickBanLobbyVeto from './pickBanVeto/pick_ban_lobby_veto.json'
import pickBanNoVeto from './pickBanVeto/pick_ban_no_veto.json'
import pickBanSideChoiceAfterVeto from './pickBanVeto/pick_ban_side_choice_after_veto.json'
import pickBanVetoChoice from './pickBanVeto/pick_ban_veto_choice.json'
import pickBanVetoSpotlightPlayed from './pickBanVeto/pick_ban_veto_spotlight_played.json'
import pickBanVetoSpotlightVetoed from './pickBanVeto/pick_ban_veto_spotlight_vetoed.json'
import type {
    MatchEditorSideErrorCode,
    PickBanCapabilities,
    PickBanChooserBasis,
    PickBanBlock,
    PickBanContractChooserReason,
    PickBanContractPacing,
    PickBanContractPhase,
    PickBanExclusion,
    PickBanPoolCard,
    PickBanSessionSequence,
    PickBanSideBlock,
    PickBanStageConfig,
    PickBanState,
    PickBanVeto,
    PickBanVetoErrorCode,
} from '@/app/utils/api'

export type ContractVetoExclusion = Required<PickBanExclusion>

export type ContractVetoPoolCard = Omit<Required<PickBanPoolCard>, 'exclusion'> & {
    exclusion: ContractVetoExclusion | null
}

export type ContractVetoSideBlock = Omit<PickBanSideBlock, 'chooser_reason' | 'chooser_basis'> & {
    chooser_reason: PickBanContractChooserReason | null
    chooser_basis: PickBanChooserBasis | null
}

export type ContractVetoPickBanState = Omit<
    PickBanState,
    'phase' | 'side' | 'veto' | 'capabilities' | 'pool' | 'pacing' | 'sequence'
> & {
    phase: PickBanContractPhase | null
    side: ContractVetoSideBlock
    veto: PickBanVeto | null
    capabilities: Required<PickBanCapabilities>
    pool: ContractVetoPoolCard[]
    pacing: PickBanContractPacing
    sequence: PickBanSessionSequence | null
}

export type ContractPickBanBlock = Omit<PickBanBlock, 'pacing'> & { pacing: PickBanContractPacing }

export type ContractPickBanStageConfig = Omit<PickBanStageConfig, 'pick_ban'> & { pick_ban: ContractPickBanBlock | null }

export interface ContractPickBanConfig {
    stages: ContractPickBanStageConfig[]
}

export interface PickBanVetoSuccessFixtures {
    pickBanLobbyVeto: ContractVetoPickBanState
    pickBanVetoChoice: ContractVetoPickBanState
    pickBanVetoSpotlightVetoed: ContractVetoPickBanState
    pickBanVetoSpotlightPlayed: ContractVetoPickBanState
    pickBanSideChoiceAfterVeto: ContractVetoPickBanState
    pickBanNoVeto: ContractVetoPickBanState
    pickBanDirectQualifier: ContractVetoPickBanState
    pickBanConfig: ContractPickBanConfig
}

export type PickBanVetoSuccessFixtureName = keyof PickBanVetoSuccessFixtures

export type PickBanVetoErrorFixtureName = 'errorVetoNotOpen' | 'errorAlreadyChosen' | 'errorVetoChoiceActive' | 'errorSideLocked'

export type PickBanVetoFixtureName = PickBanVetoSuccessFixtureName | PickBanVetoErrorFixtureName

export interface PickBanVetoErrorBody {
    success: false
    error: string
    code: PickBanVetoErrorCode | MatchEditorSideErrorCode
}

interface FixtureEntry {
    file: string
    route: string
    status: number
    body: unknown
}

const PICK_BAN_STATE_ROUTE = 'GET /tournaments/:slug/matches/:matchId/pick-ban'
const PICK_BAN_VETO_ROUTE = 'POST /tournaments/:slug/matches/:matchId/pick-ban/veto'

export const PICK_BAN_VETO_FIXTURES: Record<PickBanVetoFixtureName, FixtureEntry> = {
    pickBanLobbyVeto: { file: 'pick_ban_lobby_veto.json', route: PICK_BAN_STATE_ROUTE, status: 200, body: pickBanLobbyVeto },
    pickBanVetoChoice: { file: 'pick_ban_veto_choice.json', route: PICK_BAN_STATE_ROUTE, status: 200, body: pickBanVetoChoice },
    pickBanVetoSpotlightVetoed: {
        file: 'pick_ban_veto_spotlight_vetoed.json',
        route: PICK_BAN_VETO_ROUTE,
        status: 200,
        body: pickBanVetoSpotlightVetoed,
    },
    pickBanVetoSpotlightPlayed: {
        file: 'pick_ban_veto_spotlight_played.json',
        route: PICK_BAN_STATE_ROUTE,
        status: 200,
        body: pickBanVetoSpotlightPlayed,
    },
    pickBanSideChoiceAfterVeto: {
        file: 'pick_ban_side_choice_after_veto.json',
        route: PICK_BAN_STATE_ROUTE,
        status: 200,
        body: pickBanSideChoiceAfterVeto,
    },
    pickBanNoVeto: { file: 'pick_ban_no_veto.json', route: PICK_BAN_STATE_ROUTE, status: 200, body: pickBanNoVeto },
    pickBanDirectQualifier: {
        file: 'pick_ban_direct_qualifier.json',
        route: PICK_BAN_STATE_ROUTE,
        status: 200,
        body: pickBanDirectQualifier,
    },
    pickBanConfig: { file: 'pick_ban_config.json', route: 'GET /tournaments/:slug/pick-ban/config', status: 200, body: pickBanConfig },
    errorVetoNotOpen: { file: 'error_veto_not_open.json', route: PICK_BAN_VETO_ROUTE, status: 409, body: errorVetoNotOpen },
    errorAlreadyChosen: { file: 'error_already_chosen.json', route: PICK_BAN_VETO_ROUTE, status: 409, body: errorAlreadyChosen },
    errorVetoChoiceActive: {
        file: 'error_veto_choice_active.json',
        route: 'POST /tournaments/:slug/matches/:matchId/pick-ban/lock',
        status: 409,
        body: errorVetoChoiceActive,
    },
    errorSideLocked: {
        file: 'error_side_locked.json',
        route: 'PATCH /tournaments/:slug/admin/matches/:matchId',
        status: 409,
        body: errorSideLocked,
    },
}

export function pickBanVetoFixture<K extends PickBanVetoSuccessFixtureName>(name: K): PickBanVetoSuccessFixtures[K] {
    const body = PICK_BAN_VETO_FIXTURES[name].body as { data: PickBanVetoSuccessFixtures[K] }
    return structuredClone(body.data)
}

export function pickBanVetoErrorFixture(name: PickBanVetoErrorFixtureName): PickBanVetoErrorBody {
    return structuredClone(PICK_BAN_VETO_FIXTURES[name].body as PickBanVetoErrorBody)
}

export function pickBanVetoFixtureResponse(name: PickBanVetoFixtureName): Response {
    return new Response(JSON.stringify(PICK_BAN_VETO_FIXTURES[name].body), {
        status: PICK_BAN_VETO_FIXTURES[name].status,
        headers: { 'Content-Type': 'application/json' },
    })
}
