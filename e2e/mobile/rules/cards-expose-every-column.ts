import { cardColumnsResult } from '../tables'
import { observeTables } from './observe-tables'
import type { RuleCheck } from './types'

export const cardsExposeEveryColumn: RuleCheck = async context =>
    cardColumnsResult(await observeTables(context), context.surface.entry.decorative)
