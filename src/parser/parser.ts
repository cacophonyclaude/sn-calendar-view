import type { CalendarEvent } from './types'
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  ORDINAL_RE,
  ISO_DATE_RE,
  NUM_YEAR_RE,
  MONTH_NAME_YEAR_RE,
  MONTH_ONLY_RE,
  NUM_NO_YEAR_RE,
  MONTH_NAME_DAY_RE,
  NEXT_WEEKDAY_RE,
  WEEKDAY_RE,
  TIME_ONLY_RE,
} from './patterns'
import { extractTime, stripTime, applyTime } from './timeParser'
import { detectRange } from './rangeDetector'

// ─── Helpers ────────────────────────────────────────────────────────────────

function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Parse ordinal number: "1st" → 1, "2nd" → 2, "3" → 3 */
function parseOrdinal(s: string): number | null {
  const m = ORDINAL_RE.exec(s)
  if (m) return parseInt(m[1], 10)
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

/**
 * Year inference: if the date (at midnight) is today or in the future → current year.
 * If already past → next year.
 */
function inferYear(month: number, day: number, hours = 0, minutes = 0): Date {
  const today = todayMidnight()
  const d = new Date(today.getFullYear(), month, day, hours, minutes, 0, 0)
  if (d < today) {
    d.setFullYear(today.getFullYear() + 1)
  }
  return d
}

/** Nearest upcoming weekday (0=Sun..6=Sat). Today counts if it matches. */
function nearestWeekday(targetDay: number): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = (targetDay - today.getDay() + 7) % 7
  const result = new Date(today)
  result.setDate(today.getDate() + diff)
  return result
}

/** Next weekday in the FOLLOWING calendar week (Mon–Sun), never the current week. */
function nextWeekWeekday(targetDay: number): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find Monday of this week
  const dayOfWeek = today.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() + mondayOffset)
  // Next Monday = thisMonday + 7
  const nextMonday = new Date(thisMonday)
  nextMonday.setDate(thisMonday.getDate() + 7)
  // Find targetDay in that week (Mon=1..Sun=0)
  // nextMonday is Monday (1). We need targetDay (0-6 Sun-Sat convention)
  const sunOffset = targetDay === 0 ? 6 : targetDay - 1
  const result = new Date(nextMonday)
  result.setDate(nextMonday.getDate() + sunOffset)
  return result
}

// ─── Single-date parsing ─────────────────────────────────────────────────────

export interface SingleDateResult {
  date: Date
  hasTime: boolean
  isMonthLevel: boolean
}

/**
 * Parse a single date token (no range, no delimiter). Returns null if not parseable.
 * Exported so rangeDetector can call it.
 */
export function parseSingleDate(rawToken: string): SingleDateResult | null {
  const token = rawToken.trim()
  if (!token) return null

  // Extract and strip @time
  const timeResult = extractTime(token)
  const stripped = stripTime(token).trim()
  const hasTime = timeResult !== null

  // Priority 7 — time only (bare @time with nothing else)
  if (!stripped && hasTime) {
    const d = new Date()
    d.setSeconds(0, 0)
    applyTime(d, timeResult!)
    return { date: d, hasTime: true, isMonthLevel: false }
  }

  if (TIME_ONLY_RE.test(token)) {
    const d = new Date()
    d.setSeconds(0, 0)
    if (timeResult) applyTime(d, timeResult)
    return { date: d, hasTime: true, isMonthLevel: false }
  }

  // Priority 1 — ISO YYYY-MM-DD
  const iso = ISO_DATE_RE.exec(stripped)
  if (iso) {
    const d = new Date(
      parseInt(iso[1], 10),
      parseInt(iso[2], 10) - 1,
      parseInt(iso[3], 10),
      0, 0, 0, 0,
    )
    if (timeResult) applyTime(d, timeResult)
    return { date: d, hasTime, isMonthLevel: false }
  }

  // Priority 2 — numeric with explicit year: MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY
  const numYear = NUM_YEAR_RE.exec(stripped)
  if (numYear) {
    const mm = parseInt(numYear[1], 10) - 1
    const dd = parseInt(numYear[2], 10)
    let yyyy = parseInt(numYear[3], 10)
    if (numYear[3].length === 2) {
      yyyy = yyyy <= 69 ? 2000 + yyyy : 1900 + yyyy
    }
    const d = new Date(yyyy, mm, dd, 0, 0, 0, 0)
    if (timeResult) applyTime(d, timeResult)
    return { date: d, hasTime, isMonthLevel: false }
  }

  // Priority 3 — Month name with year: "Month DD YYYY" or "Month YYYY"
  const monthNameYear = MONTH_NAME_YEAR_RE.exec(stripped)
  if (monthNameYear) {
    const monthIdx = MONTH_NAMES[monthNameYear[1].toLowerCase()]
    if (monthIdx !== undefined) {
      const day = parseOrdinal(monthNameYear[2])
      const year = parseInt(monthNameYear[3], 10)
      if (day !== null) {
        const d = new Date(year, monthIdx, day, 0, 0, 0, 0)
        if (timeResult) applyTime(d, timeResult)
        return { date: d, hasTime, isMonthLevel: false }
      }
    }
  }

  const monthOnly = MONTH_ONLY_RE.exec(stripped)
  if (monthOnly) {
    const monthIdx = MONTH_NAMES[monthOnly[1].toLowerCase()]
    if (monthIdx !== undefined) {
      const year = parseInt(monthOnly[2], 10)
      const d = new Date(year, monthIdx, 1, 0, 0, 0, 0)
      // @time not allowed for month-level
      return { date: d, hasTime: false, isMonthLevel: true }
    }
  }

  // Priority 4 — numeric without year: MM/DD or MM-DD
  const numNoYear = NUM_NO_YEAR_RE.exec(stripped)
  if (numNoYear) {
    const mm = parseInt(numNoYear[1], 10) - 1
    const dd = parseInt(numNoYear[2], 10)
    const h = timeResult ? timeResult.hours : 0
    const min = timeResult ? timeResult.minutes : 0
    const d = inferYear(mm, dd, h, min)
    if (!timeResult) d.setHours(0, 0, 0, 0)
    return { date: d, hasTime, isMonthLevel: false }
  }

  // Priority 5 — Month name without year: "Month DD"
  const monthNameDay = MONTH_NAME_DAY_RE.exec(stripped)
  if (monthNameDay) {
    const monthIdx = MONTH_NAMES[monthNameDay[1].toLowerCase()]
    if (monthIdx !== undefined) {
      const day = parseOrdinal(monthNameDay[2])
      if (day !== null) {
        const h = timeResult ? timeResult.hours : 0
        const min = timeResult ? timeResult.minutes : 0
        const d = inferYear(monthIdx, day, h, min)
        if (!timeResult) d.setHours(0, 0, 0, 0)
        return { date: d, hasTime, isMonthLevel: false }
      }
    }
  }

  // Priority 6 — weekday
  const nextWd = NEXT_WEEKDAY_RE.exec(stripped)
  if (nextWd) {
    const wdIdx = WEEKDAY_NAMES[nextWd[1].toLowerCase()]
    if (wdIdx !== undefined) {
      const d = nextWeekWeekday(wdIdx)
      if (timeResult) applyTime(d, timeResult)
      return { date: d, hasTime, isMonthLevel: false }
    }
  }

  const wd = WEEKDAY_RE.exec(stripped)
  if (wd) {
    const wdIdx = WEEKDAY_NAMES[wd[1].toLowerCase()]
    if (wdIdx !== undefined) {
      const d = nearestWeekday(wdIdx)
      if (timeResult) applyTime(d, timeResult)
      return { date: d, hasTime, isMonthLevel: false }
    }
  }

  return null
}

// ─── Line parsing ─────────────────────────────────────────────────────────────

/** Simple stable hash for IDs */
function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/**
 * Find the main delimiter ('-' or ':') separating the date token from the title.
 * We need to avoid treating range '-' as the delimiter.
 *
 * Strategy: scan from right to left for ' - ' or ' : ' (space-padded),
 * then fall back to just '-' or ':' without spaces.
 * We return the split that yields a parseable date token on the left.
 */
function splitLine(line: string): { dateToken: string; title: string } | null {
  // Try spaced delimiters first: " - " and " : "
  // Scan all occurrences right-to-left so we get the last valid split
  // (for "April 2 - April 12 - Vacation" we want the last " - ")
  const spacedDelims = [' - ', ' : ']
  for (const delim of spacedDelims) {
    let idx = line.lastIndexOf(delim)
    let iters = 0
    while (idx >= 0 && iters++ < 20) {
      const dateToken = line.slice(0, idx).trim()
      const title = line.slice(idx + delim.length).trim()
      if (dateToken && title) {
        // Check if dateToken can be parsed (either as range or single date)
        const rangeResult = detectRange(dateToken)
        if (rangeResult) return { dateToken, title }
        const single = parseSingleDate(dateToken)
        if (single) return { dateToken, title }
      }
      idx = line.lastIndexOf(delim, idx - 1)
    }
  }

  // Fall back to unspaced '-' or ':'
  const unspacedDelims = ['-', ':']
  for (const delim of unspacedDelims) {
    // Try from the last occurrence going left
    let idx = line.lastIndexOf(delim)
    let iters = 0
    while (idx >= 0 && iters++ < 20) {
      const dateToken = line.slice(0, idx).trim()
      const title = line.slice(idx + 1).trim()
      if (dateToken && title) {
        const rangeResult = detectRange(dateToken)
        if (rangeResult) return { dateToken, title }
        const single = parseSingleDate(dateToken)
        if (single) return { dateToken, title }
      }
      idx = line.lastIndexOf(delim, idx - 1)
    }
  }

  return null
}

/** Parse a single text line into a CalendarEvent, or null if not parseable */
function parseLine(line: string, lineIndex: number): CalendarEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  // No alphanumeric chars → can't be a valid date entry (e.g. "------", "--")
  if (!/[a-z0-9]/i.test(trimmed)) return null

  const split = splitLine(trimmed)
  if (!split) return null

  const { dateToken, title } = split
  if (!title) return null
  if (!/[a-z0-9]/i.test(title)) return null

  const today = todayMidnight()

  // Try range first
  const rangeResult = detectRange(dateToken)
  if (rangeResult) {
    const { startDate, endDate, hasTime } = rangeResult
    const isPast = endDate < today
    const isRange = !sameCalendarDay(startDate, endDate)
    return {
      id: hashString(`${lineIndex}:${line}`),
      lineIndex,
      title,
      startDate,
      endDate,
      hasTime,
      isRange,
      isMonthLevel: false,
      isPast,
    }
  }

  // Try single date
  const single = parseSingleDate(dateToken)
  if (!single) return null

  const { date, hasTime, isMonthLevel } = single
  const endDate = new Date(date)
  const isPast = endDate < today

  return {
    id: hashString(`${lineIndex}:${line}`),
    lineIndex,
    title,
    startDate: date,
    endDate,
    hasTime,
    isRange: false,
    isMonthLevel,
    isPast,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse a full note text into CalendarEvents. */
export function parseNote(text: string): CalendarEvent[] {
  const lines = text.split('\n')
  const events: CalendarEvent[] = []
  for (let i = 0; i < lines.length; i++) {
    const event = parseLine(lines[i], i)
    if (event) events.push(event)
  }
  return events
}
