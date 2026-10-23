import type { MatchSideStatus } from '@/app/utils/api'
import { sideColorOfLetter, sideColorTone, sideTagOf } from '@/app/utils/sideLabels'
import type { PickBanTone } from '@/app/components/broadcast/broadcastTone'
import type { StreamSide } from './data/streamHotState'

export interface SceneSideTag {
    label: string
    tone: PickBanTone
    confirmed: boolean
}

export type SceneSideTags = Record<StreamSide, SceneSideTag>

function sideTagFor(side: StreamSide, status: MatchSideStatus): SceneSideTag {
    const color = sideColorOfLetter(side === 'a' ? 'A' : 'B')
    return { label: sideTagOf(color, status.confirmed), tone: status.confirmed ? sideColorTone(color) : 'neutral', confirmed: status.confirmed }
}

export function sceneSideTags(status: MatchSideStatus): SceneSideTags {
    return { a: sideTagFor('a', status), b: sideTagFor('b', status) }
}
