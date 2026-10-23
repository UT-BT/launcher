import type { PickBanChooserBasis, PickBanContractChooserReason, PickBanPlayoffRecord } from '@/app/utils/api'

export type ChooserReason = PickBanContractChooserReason

type BasisValue = PickBanChooserBasis['chooser']

interface ReasonCopy {
    text: string
    basis?: (value: BasisValue) => string | null
}

function ordinal(position: number): string {
    const tens = position % 100
    if (tens >= 11 && tens <= 13) return `${position}th`
    const suffix = ['th', 'st', 'nd', 'rd'][position % 10] ?? 'th'
    return `${position}${suffix}`
}

function isRecord(value: BasisValue): value is PickBanPlayoffRecord {
    return typeof value === 'object' && value !== null
}

function placingOf(value: BasisValue): string | null {
    return typeof value === 'number' ? ordinal(value) : null
}

function seedOf(value: BasisValue): string | null {
    return typeof value === 'number' ? String(value) : null
}

function recordOf(value: BasisValue): string | null {
    return isRecord(value) ? `${value.wins}-${value.losses}` : null
}

const REASON_COPY: Record<ChooserReason, ReasonCopy> = {
    direct_qualifier: { text: 'playoff qualifier vs direct qualifier' },
    lower_playoff_record: { text: 'worse playoff record', basis: recordOf },
    lower_group_placing: { text: 'lower group finish', basis: placingOf },
    lower_pre_cup_seed: { text: 'higher pre-cup seed', basis: seedOf },
    admin: { text: 'named by an admin' },
}

export function chooserReasonText(reason: ChooserReason, basis: PickBanChooserBasis | null | undefined): string {
    const copy = REASON_COPY[reason]
    if (!copy.basis || !basis) return copy.text
    const chooser = copy.basis(basis.chooser)
    const other = copy.basis(basis.other)
    return chooser === null || other === null ? copy.text : `${copy.text} (${chooser} vs ${other})`
}

export function chooserLine(teamName: string, reason: ChooserReason, basis: PickBanChooserBasis | null | undefined): string {
    return `${teamName} choose: ${chooserReasonText(reason, basis)}`
}
