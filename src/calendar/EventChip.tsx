import type { CalendarEvent } from '../parser/types'
import styles from './EventChip.module.css'

interface Props {
  event: CalendarEvent
  slot: number
  colStart: number
  colSpan: number
  weekStart: Date
  weekEnd: Date
  onClick: () => void
}

/** Format time like "3pm" or "9:30am" */
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

export default function EventChip({
  event,
  slot,
  colStart,
  colSpan,
  weekStart,
  weekEnd,
  onClick,
}: Props) {
  const isRange = event.isRange
  // Determine if this event visually starts/ends within this week
  const startsThisWeek = event.startDate >= weekStart || sameDay(event.startDate, weekStart)
  const endsThisWeek = event.endDate <= weekEnd || sameDay(event.endDate, weekEnd)

  const classNames = [
    styles.chip,
    isRange ? styles.rangeBar : styles.singleChip,
    event.isMonthLevel ? styles.monthLevel : '',
    event.isPast ? styles.past : '',
    startsThisWeek ? styles.roundLeft : '',
    endsThisWeek ? styles.roundRight : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Grid layout: 7 columns, each 1fr. Use CSS grid column positioning.
  const style: React.CSSProperties = {
    gridColumn: `${colStart + 1} / span ${colSpan}`,
    gridRow: `${slot + 2}`, // row 1 is day numbers, rows 2+ are slots
    zIndex: 1,
  }

  return (
    <button className={classNames} style={style} onClick={onClick} title={event.title}>
      {isRange ? (
        <span className={styles.chipText}>
          {event.hasTime && <strong>{formatTime(event.startDate)} </strong>}
          {event.isMonthLevel ? <em>{event.title}</em> : event.title}
        </span>
      ) : (
        <span className={styles.chipText}>
          {event.hasTime && <strong>{formatTime(event.startDate)} </strong>}
          {event.isMonthLevel ? <em>{event.title}</em> : event.title}
        </span>
      )}
    </button>
  )
}
