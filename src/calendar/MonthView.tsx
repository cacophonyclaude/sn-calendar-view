import { useMemo } from 'react'
import type { CalendarEvent } from '../parser/types'
import { assignSlots } from './slotAlgorithm'
import EventChip from './EventChip'
import styles from './MonthView.module.css'

interface Props {
  weekStart: Date          // Monday of the first row to display
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onWeekClick: (weekStart: Date) => void  // navigate to week view
}

const DAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_LABELS_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MAX_VISIBLE_SLOTS = 3

export default function MonthView({ weekStart, events, onEventClick, onWeekClick }: Props) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Always 5 weeks starting from weekStart
  const weeks = useMemo(() => buildWeeks(weekStart), [weekStart])

  // Pre-compute slot assignments for all 5 weeks (avoids re-running on every render)
  const weekSlots = useMemo(
    () => weeks.map(week => assignSlots(events, week[0], week[6])),
    [weeks, events],
  )

  return (
    <div className={styles.monthView}>
      {/* Day-of-week header */}
      <div className={styles.header}>
        {DAY_LABELS_SHORT.map((short, i) => (
          <div key={short} className={`${styles.headerCell} ${i >= 5 ? styles.weekend : ''}`}>
            <span className={styles.dayLabelShort}>{short}</span>
            <span className={styles.dayLabelLong}>{DAY_LABELS_LONG[i]}</span>
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const rowStart = week[0]   // Monday
        const rowEnd = week[6]     // Sunday
        const slotted = weekSlots[wi]

        const bySlot: Record<number, typeof slotted[0][]> = { 0: [], 1: [], 2: [] }
        const overflowByCol: Record<number, number> = {}

        for (const ev of slotted) {
          if (ev.slot < MAX_VISIBLE_SLOTS) {
            bySlot[ev.slot].push(ev)
          } else {
            for (let c = ev.colStart; c < ev.colStart + ev.colSpan; c++) {
              overflowByCol[c] = (overflowByCol[c] ?? 0) + 1
            }
          }
        }

        return (
          <div key={wi} className={styles.weekRow}>
            {week.map((day, di) => {
              const isToday = sameDay(day, today)
              const cellLabels = slotted.filter(e => e.colStart === di)

              return (
                <div
                  key={di}
                  className={`${styles.dayCell} ${di >= 5 ? styles.weekend : ''}`}
                  onClick={() => onWeekClick(rowStart)}
                >
                  <div className={`${styles.dayNumber} ${isToday ? styles.today : ''}`}>
                    {day.getDate()}
                  </div>

                  {/* Mobile: small text labels */}
                  <div className={styles.dots}>
                    {cellLabels.slice(0, 3).map(e => (
                      <span key={e.id} className={styles.dot}>
                        {e.title}
                      </span>
                    ))}
                  </div>

                  {/* Overflow "+N more" */}
                  {(overflowByCol[di] ?? 0) > 0 && (
                    <button
                      className={styles.moreLink}
                      onClick={e => { e.stopPropagation(); onWeekClick(rowStart) }}
                    >
                      +{overflowByCol[di]} more
                    </button>
                  )}
                </div>
              )
            })}

            {/* Event chips/bars overlaid on the row */}
            <div className={styles.eventLayer} aria-hidden="false">
              {[0, 1, 2].flatMap(slot =>
                bySlot[slot].map(ev => (
                  <EventChip
                    key={ev.id + slot}
                    event={ev}
                    slot={slot}
                    colStart={ev.colStart}
                    colSpan={ev.colSpan}
                    weekStart={rowStart}
                    weekEnd={rowEnd}
                    onClick={() => onEventClick(ev)}
                  />
                )),
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Build exactly 5 weeks starting from the given Monday. */
function buildWeeks(weekStart: Date): Date[][] {
  const weeks: Date[][] = []
  const cursor = new Date(weekStart)
  cursor.setHours(0, 0, 0, 0)
  for (let w = 0; w < 5; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}
