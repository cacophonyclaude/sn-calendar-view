import { useMemo, useEffect, useRef } from 'react'
import type { CalendarEvent } from '../parser/types'
import { assignSlots } from './slotAlgorithm'
import EventChip from './EventChip'
import styles from './WeekView.module.css'

interface Props {
  weekStart: Date   // Monday
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

const DAY_ABBRS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_ABBRS_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOUR_START = 7    // 7am
const HOUR_END = 22     // 10pm (last label)
const PX_PER_HOUR = 48
const TIMED_EVENT_HEIGHT = Math.round(0.5 * PX_PER_HOUR) // 24px = 30 min

const SECTIONS = [
  {
    label: 'Morning',
    filterHours: (h: number) => h >= 5 && h < 12,
    posStart: 5,
    posEnd: 12,
    virtualHour: (h: number) => h,
  },
  {
    label: 'Afternoon',
    filterHours: (h: number) => h >= 12 && h < 18,
    posStart: 12,
    posEnd: 18,
    virtualHour: (h: number) => h,
  },
  {
    // Evening: 6pm–11pm positioned normally; 11pm–5am mapped to virtual hours 23–29
    label: 'Evening',
    filterHours: (h: number) => h >= 18 || h < 5,
    posStart: 18,
    posEnd: 29,
    virtualHour: (h: number) => h >= 18 ? h : h + 24,
  },
]

/** Resolve time-proportional positions so no two events overlap and none runs off
 *  the bottom.  Works in percentage space so no pixel measurements needed.
 *  minHeightPct: minimum gap between event tops (≈ event height as % of section). */
function resolvePositions(topPcts: number[], minHeightPct: number): number[] {
  const maxTop = 100 - minHeightPct  // last event can start no lower than this
  const resolved = [...topPcts]
  // Forward pass: push each event down to maintain minimum gap, cap from bottom
  for (let i = 0; i < resolved.length; i++) {
    if (i > 0) resolved[i] = Math.max(resolved[i], resolved[i - 1] + minHeightPct)
    // Reserve enough room below for all remaining events
    resolved[i] = Math.min(resolved[i], maxTop - (resolved.length - 1 - i) * minHeightPct)
  }
  // Second forward pass to re-enforce gaps after the cap pulled events up
  for (let i = 1; i < resolved.length; i++) {
    resolved[i] = Math.max(resolved[i], resolved[i - 1] + minHeightPct)
  }
  return resolved
}

function formatHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function formatTime(d: Date): string {
  let h = d.getHours()
  const min = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  if (h > 12) h -= 12
  if (h === 0) h = 12
  if (min === 0) return `${h}${ampm}`
  return `${h}:${String(min).padStart(2, '0')}${ampm}`
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function WeekView({ weekStart, events, onEventClick }: Props) {
  const weekViewRef = useRef<HTMLDivElement>(null)
  const timedGridRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // All-day events: ranges, untimed singles, month-level
  const allDayEvents = useMemo(
    () => events.filter(e => e.isRange || !e.hasTime || e.isMonthLevel),
    [events],
  )

  // Timed events: single-day, timed, not range, not month-level
  const timedEvents = useMemo(
    () =>
      events.filter(
        e => e.hasTime && !e.isRange && !e.isMonthLevel &&
          days.some(d => sameDay(d, e.startDate)),
      ),
    [events, days],
  )

  // Mobile: group timed events by section (Morning / Afternoon / Evening)
  const timedBySection = useMemo(
    () => SECTIONS.map(section => ({
      label: section.label,
      posStart: section.posStart,
      posEnd: section.posEnd,
      virtualHour: section.virtualHour,
      byDay: days.map(day =>
        timedEvents
          .filter(e =>
            sameDay(e.startDate, day) &&
            section.filterHours(e.startDate.getHours())
          )
          .sort((a, b) => {
            const av = section.virtualHour(a.startDate.getHours()) * 60 + a.startDate.getMinutes()
            const bv = section.virtualHour(b.startDate.getHours()) * 60 + b.startDate.getMinutes()
            return av - bv
          })
      ),
    })),
    [timedEvents, days],
  )

  // Slot assignment for all-day row
  const slottedAllDay = useMemo(
    () => assignSlots(allDayEvents, weekStart, weekEnd),
    [allDayEvents, weekStart, weekEnd],
  )
  const maxSlot = slottedAllDay.reduce((m, e) => Math.max(m, e.slot), -1)
  const allDayRowHeight = Math.max(30, (maxSlot + 1) * 26 + 6)

  // Reset scroll position when the week changes.
  // Vertical: always start at top.
  // Horizontal (mobile): scroll so today's column is as far left as possible.
  useEffect(() => {
    if (timedGridRef.current) timedGridRef.current.scrollTop = 0
    if (weekViewRef.current) {
      weekViewRef.current.scrollTop = 0
      const todayIndex = days.findIndex(d => sameDay(d, today))
      // 96px matches the mobile column min-width in CSS
      weekViewRef.current.scrollLeft = todayIndex >= 0 ? todayIndex * 96 : 0
    }
  }, [weekStart, days, today])

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i)
  const totalGridHeight = (HOUR_END - HOUR_START + 1) * PX_PER_HOUR

  return (
    <div ref={weekViewRef} className={styles.weekView}>
      {/* Column headers */}
      <div className={styles.colHeaders}>
        <div className={styles.gutterSpacer} />
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          return (
            <div key={i} className={`${styles.colHeader} ${isToday ? styles.todayCol : ''} ${i >= 5 ? styles.weekend : ''}`}>
              <span className={`${styles.colDayName} ${styles.dayLabelShort}`}>{DAY_ABBRS_SHORT[i]}</span>
              <span className={`${styles.colDayName} ${styles.dayLabelLong}`}>{DAY_ABBRS_LONG[i]}</span>
              <span className={`${styles.colDayNum} ${isToday ? styles.todayCircle : ''}`}>
                {day.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      <div className={styles.allDayRow} style={{ minHeight: allDayRowHeight }}>
        <div className={styles.allDayLabel}>All-day</div>
        <div className={styles.allDayGrid} style={{ minHeight: allDayRowHeight }}>
          {slottedAllDay.map(ev => (
            <EventChip
              key={ev.id}
              event={ev}
              slot={ev.slot}
              colStart={ev.colStart}
              colSpan={ev.colSpan}
              weekStart={weekStart}
              weekEnd={weekEnd}
              onClick={() => onEventClick(ev)}
            />
          ))}
        </div>
      </div>

      {/* Mobile: section-based view replacing the hour grid */}
      <div className={styles.sectionView}>
        {timedBySection.map(section => {
          return (
            <div key={section.label} className={styles.sectionRow}>
              <div className={styles.sectionLabel}>{section.label}</div>
              <div className={styles.sectionColumns}>
                {section.byDay.map((dayEvs, di) => {
                  const duration = section.posEnd - section.posStart
                  const rawPcts = dayEvs.map(ev => {
                    const vHour = section.virtualHour(ev.startDate.getHours()) + ev.startDate.getMinutes() / 60
                    return ((vHour - section.posStart) / duration) * 100
                  })
                  const topPcts = resolvePositions(rawPcts, 14)
                  return (
                    <div key={di} className={`${styles.sectionDayCol} ${di >= 5 ? styles.weekend : ''}`}>
                      {dayEvs.map((ev, idx) => (
                        <button
                          key={ev.id}
                          className={`${styles.sectionEvent} ${ev.isPast ? styles.pastEvent : ''}`}
                          style={{ top: `${topPcts[idx].toFixed(1)}%` }}
                          onClick={() => onEventClick(ev)}
                          title={ev.title}
                        >
                          <strong className={styles.timedEventTime}>{formatTime(ev.startDate)}</strong>
                          {' '}
                          <span className={styles.timedEventTitle}>{ev.title}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Timed grid */}
      <div ref={timedGridRef} className={styles.timedGrid}>
        <div className={styles.timedInner} style={{ height: totalGridHeight }}>
          {/* Hour labels + horizontal lines */}
          {hours.map(h => (
            <div
              key={h}
              className={styles.hourRow}
              style={{ top: (h - HOUR_START) * PX_PER_HOUR, height: PX_PER_HOUR }}
            >
              <div className={styles.hourLabel}>{formatHour(h)}</div>
              <div className={styles.hourLine} />
            </div>
          ))}

          {/* Day columns */}
          <div className={styles.dayColumns}>
            {days.map((day, di) => {
              const isPastDay = day < today && !sameDay(day, today)
              // Sort by start time so next-event calculation is correct
              const dayEvs = timedEvents
                .filter(e => sameDay(e.startDate, day))
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
              return (
                <div
                  key={di}
                  className={`${styles.dayColumn} ${isPastDay ? styles.pastDayColumn : ''} ${di >= 5 ? styles.weekend : ''}`}
                >
                  {dayEvs.map((ev, idx) => {
                    const top =
                      (ev.startDate.getHours() - HOUR_START) * PX_PER_HOUR +
                      (ev.startDate.getMinutes() / 60) * PX_PER_HOUR
                    const nextEv = dayEvs[idx + 1]
                    const nextTop = nextEv
                      ? (nextEv.startDate.getHours() - HOUR_START) * PX_PER_HOUR +
                        (nextEv.startDate.getMinutes() / 60) * PX_PER_HOUR
                      : totalGridHeight
                    const maxHeight = Math.max(TIMED_EVENT_HEIGHT, nextTop - top - 4)
                    return (
                      <button
                        key={ev.id}
                        className={`${styles.timedEvent} ${ev.isPast ? styles.pastEvent : ''}`}
                        style={{ top, minHeight: TIMED_EVENT_HEIGHT, maxHeight }}
                        onClick={() => onEventClick(ev)}
                        title={ev.title}
                      >
                        <strong className={styles.timedEventTime}>{formatTime(ev.startDate)}</strong>
                        {' '}
                        <span className={styles.timedEventTitle}>{ev.title}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
