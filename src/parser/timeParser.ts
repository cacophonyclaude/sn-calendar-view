import { TIME_RE } from './patterns'

export interface TimeResult {
  hours: number
  minutes: number
}

/**
 * Extract @time from a date token string.
 * Returns null if no @time present.
 */
export function extractTime(token: string): TimeResult | null {
  const m = TIME_RE.exec(token)
  if (!m) return null

  let hours = parseInt(m[1], 10)
  const minutes = m[2] ? parseInt(m[2], 10) : 0
  const meridiem = m[3] ? m[3].toLowerCase() : null

  if (meridiem === 'am') {
    if (hours === 12) hours = 0
  } else if (meridiem === 'pm') {
    if (hours !== 12) hours += 12
  }
  // no meridiem: treat as-is (24h or bare int as-is)

  return { hours, minutes }
}

/** Remove @time portion from token string */
export function stripTime(token: string): string {
  return token.replace(TIME_RE, '').trim()
}

/** Apply time to a Date (modifies in place) */
export function applyTime(date: Date, time: TimeResult): void {
  date.setHours(time.hours, time.minutes, 0, 0)
}
