import type { CalendarEvent } from '../parser/types'

export interface SlottedEvent extends CalendarEvent {
  slot: number
  colStart: number  // 0-based column within the week (0=Mon, 6=Sun)
  colSpan: number   // number of columns this event spans in this week
}

/**
 * Greedy slot assignment for a single week row.
 *
 * Used by MonthView (called per week row) and WeekView all-day row.
 *
 * @param events  All events to consider (will be filtered to those overlapping this week)
 * @param weekStart  Monday 00:00 of the week
 * @param weekEnd    Sunday 23:59:59 of the week
 */
export function assignSlots(
  events: CalendarEvent[],
  weekStart: Date,
  weekEnd: Date,
): SlottedEvent[] {
  // Filter to events that overlap this week
  const overlapping = events.filter(e => {
    const eStart = dayStart(e.startDate)
    const eEnd = dayStart(e.endDate)
    const wStart = dayStart(weekStart)
    const wEnd = dayStart(weekEnd)
    return eStart <= wEnd && eEnd >= wStart
  })

  // Sort: longest span first, then earlier start
  const sorted = [...overlapping].sort((a, b) => {
    const spanA = daySpan(a.startDate, a.endDate)
    const spanB = daySpan(b.startDate, b.endDate)
    if (spanB !== spanA) return spanB - spanA
    return a.startDate.getTime() - b.startDate.getTime()
  })

  // Slot occupancy: slot → Set of column indices occupied
  const occupancy: Map<number, Set<number>> = new Map()

  const result: SlottedEvent[] = []

  for (const event of sorted) {
    const colStart = eventColStart(event.startDate, weekStart)
    const colEnd = eventColEnd(event.endDate, weekEnd)
    const colSpan = colEnd - colStart + 1

    // Find the lowest slot where none of the columns are occupied
    let slot = 0
    while (true) {
      if (!occupancy.has(slot)) occupancy.set(slot, new Set())
      const occupied = occupancy.get(slot)!
      let fits = true
      for (let c = colStart; c <= colEnd; c++) {
        if (occupied.has(c)) { fits = false; break }
      }
      if (fits) {
        for (let c = colStart; c <= colEnd; c++) occupied.add(c)
        break
      }
      slot++
    }

    result.push({ ...event, slot, colStart, colSpan })
  }

  return result
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dayStart(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function daySpan(start: Date, end: Date): number {
  const s = dayStart(start).getTime()
  const e = dayStart(end).getTime()
  return Math.round((e - s) / 86400000) + 1
}

/** Column index of event start within the week (clamped to 0) */
function eventColStart(startDate: Date, weekStart: Date): number {
  const diff = Math.round(
    (dayStart(startDate).getTime() - dayStart(weekStart).getTime()) / 86400000,
  )
  return Math.max(0, diff)
}

/** Column index of event end within the week (clamped to 6) */
function eventColEnd(endDate: Date, weekEnd: Date): number {
  const diff = Math.round(
    (dayStart(endDate).getTime() - dayStart(weekEnd).getTime()) / 86400000,
  )
  // weekEnd is Sunday (col 6); diff <= 0 means it ends within or before the week
  return Math.min(6, 6 + diff)
}
