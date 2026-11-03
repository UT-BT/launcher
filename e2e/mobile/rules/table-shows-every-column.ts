import { tableColumnsResult } from '../tables'
import { observeTables } from './observe-tables'
import type { RuleCheck } from './types'

export const tableShowsEveryColumn: RuleCheck = async context =>
    tableColumnsResult(await observeTables(context), context.surface.entry.decorative)
