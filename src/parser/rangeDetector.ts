import { parseSingleDate } from './parser'

export interface RangeResult {
  startDate: Date
  endDate: Date
  hasTime: boolean
}

/**
 * Try to detect a date range from a raw date token (before the title delimiter).
 *
 * Strategy:
 *   1. Compact/spaced range: scan every '-' and try to split into two parseable dates.
 *      Accept the first split where both sides parse and endDate >= startDate.
 *      We skip splits that would be consumed by ISO YYYY-MM-DD parsing.
 *
 * Returns null if no range is found.
 */
export function detectRange(token: string): RangeResult | null {
  // Find all positions of '-' in the token
  const positions: number[] = []
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '-') positions.push(i)
  }

  for (const pos of positions) {
    const left = token.slice(0, pos).trim()
    const right = token.slice(pos + 1).trim()

    if (!left || !right) continue

    const startResult = parseSingleDate(left)
    if (!startResult) continue

    const endResult = parseSingleDate(right)
    if (!endResult) continue

    // endDate must be >= startDate (by timestamp)
    if (endResult.date >= startResult.date) {
      return {
        startDate: startResult.date,
        endDate: endResult.date,
        hasTime: startResult.hasTime || endResult.hasTime,
      }
    }
  }

  return null
}
