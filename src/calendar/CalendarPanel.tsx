import { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { CalendarEvent } from '../parser/types'
import MonthView from './MonthView'
import WeekView from './WeekView'
import styles from './CalendarPanel.module.css'

type CalView = 'month' | 'week'

interface Props {
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  isMobile: boolean
  calendarMode?: 'month' | 'week'
}

export interface CalendarPanelHandle {
  navPrev: () => void
  navNext: () => void
  setView: (view: 'month' | 'week') => void
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n * 7)
  return r
}

/** Get the Monday of the week containing d */
function weekMonday(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const offset = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() + offset)
  return r
}

function formatMonthLabel(weekStart: Date, short: boolean): string {
  // 5-week view: last day is weekStart + 34 days
  const lastDay = new Date(weekStart)
  lastDay.setDate(lastDay.getDate() + 34)

  const startMonth = weekStart.getMonth()
  const startYear = weekStart.getFullYear()
  const endMonth = lastDay.getMonth()
  const endYear = lastDay.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return weekStart.toLocaleString('default', { month: 'long', year: 'numeric' })
  }

  const monthLen = short ? 'short' : 'long'
  const fmt = (d: Date) => d.toLocaleString('default', { month: monthLen })
  if (startYear === endYear) {
    return `${fmt(weekStart)} – ${fmt(lastDay)} ${startYear}`
  }
  return `${fmt(weekStart)} ${startYear} – ${fmt(lastDay)} ${endYear}`
}

function formatWeekLabel(weekStart: Date, short: boolean): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  const year = weekEnd.getFullYear()
  const monthLen = short ? 'short' : 'long'
  if (sameMonth) {
    const month = weekStart.toLocaleString('default', { month: monthLen })
    return `${month} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${year}`
  }
  const fmt = (d: Date) => d.toLocaleString('default', { month: monthLen, day: 'numeric' })
  return `${fmt(weekStart)} – ${fmt(weekEnd)}, ${year}`
}

const CalendarPanel = forwardRef<CalendarPanelHandle, Props>(function CalendarPanel(
  { events, onEventClick, isMobile, calendarMode },
  ref,
) {
  const today = useMemo(() => new Date(), [])

  const [view, setView] = useState<CalView>(calendarMode ?? 'month')

  useEffect(() => {
    if (calendarMode) setView(calendarMode)
  }, [calendarMode])
  const [monthWeekStart, setMonthWeekStart] = useState(() => weekMonday(today))
  const [weekStart, setWeekStart] = useState(() => weekMonday(today))

  const goToWeek = useCallback((date: Date) => {
    setWeekStart(weekMonday(date))
    setView('week')
  }, [])

  const navPrev = useCallback(() => {
    if (view === 'month') setMonthWeekStart(d => addWeeks(d, -4))
    else setWeekStart(d => addWeeks(d, -1))
  }, [view])

  const navNext = useCallback(() => {
    if (view === 'month') setMonthWeekStart(d => addWeeks(d, 4))
    else setWeekStart(d => addWeeks(d, 1))
  }, [view])

  const goToday = useCallback(() => {
    if (view === 'month') setMonthWeekStart(weekMonday(today))
    else setWeekStart(weekMonday(today))
  }, [view, today])

  useImperativeHandle(ref, () => ({ navPrev, navNext, setView }), [navPrev, navNext, setView])

  const label =
    view === 'month'
      ? formatMonthLabel(monthWeekStart, isMobile)
      : formatWeekLabel(weekStart, isMobile)

  return (
    <div className={styles.panel}>
      {/* Fixed header */}
      <div className={styles.header}>
        <div className={styles.navGroup}>
          <div className={styles.navButtons}>
            <button className={styles.navBtn} onClick={navPrev} aria-label="Previous">&#8592;</button>
            <button className={styles.navBtn} onClick={navNext} aria-label="Next">&#8594;</button>
          </div>
          <span className={styles.dateLabel}>{label}</span>
        </div>
        <div className={styles.controls}>
          <button className={styles.todayBtn} onClick={goToday}>Today</button>
          <div className={styles.viewTabs}>
            <button
              className={`${styles.viewTab} ${view === 'month' ? styles.activeTab : ''}`}
              onClick={() => setView('month')}
            >
              Month
            </button>
            <button
              className={`${styles.viewTab} ${view === 'week' ? styles.activeTab : ''}`}
              onClick={() => setView('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* View content */}
      <div className={styles.content}>
        {view === 'month' ? (
          <MonthView
            weekStart={monthWeekStart}
            events={events}
            onEventClick={onEventClick}
            onWeekClick={goToWeek}
          />
        ) : (
          <WeekView
            weekStart={weekStart}
            events={events}
            onEventClick={onEventClick}
          />
        )}
      </div>
    </div>
  )
})

export default CalendarPanel
export type { CalView }
