import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ComponentRelay from '@standardnotes/component-relay'
import TextEditor, { type TextEditorHandle } from './editor/TextEditor'
import CalendarPanel, { type CalendarPanelHandle } from './calendar/CalendarPanel'
import { parseNote } from './parser/parser'
import { parseNoteSettings } from './parser/settingsParser'
import type { CalendarEvent } from './parser/types'
import styles from './App.module.css'

// ─── Dev fallback note ───────────────────────────────────────────────────────

const DEV_NOTE = `My Calendar Note

Thurs @3pm - Dentist
Mon @9am - Call accountant
4/15 - Tax deadline
next Friday @2pm - Team lunch
April 2-April 12 - Vacation
March 2027 - Pay quarterly taxes
2027-06-15 - Conference
Sat - Grocery run
@11am - Morning standup`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* sandboxed */ }
}

type MobileTab = 'edit' | 'calendar'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 50)
    }
    window.addEventListener('resize', handler)
    return () => { window.removeEventListener('resize', handler); clearTimeout(timer) }
  }, [])
  return isMobile
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const isMobile = useIsMobile()

  // Note text is driven by direct DOM access (uncontrolled textarea),
  // NOT by React state — avoids cursor jumping and re-render overhead.
  // `events` is the only derived state we keep in React.
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const calendarRef = useRef<CalendarPanelHandle>(null)
  const relayRef = useRef<ComponentRelay | null>(null)
  const noteRef = useRef<Record<string, unknown> | null>(null)
  const editorRef = useRef<TextEditorHandle>(null)
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [verifyMode, setVerifyMode] = useState(false)
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month')
  const toggleVerify = useCallback(() => setVerifyMode(v => !v), [])
  const verifyLineIndices = useMemo(() => events.map(e => e.lineIndex), [events])

  const [splitView, setSplitView] = useState(true)
  const [mobileTab, setMobileTab] = useState<MobileTab>(
    () => (lsGet('sn-calendar-mobile-tab') as MobileTab) ?? 'edit',
  )
  const [splitRatio, setSplitRatio] = useState(() => {
    const stored = lsGet('sn-calendar-ratio')
    return stored ? Math.max(20, Math.min(80, Number(stored))) : 35
  })
  const mainRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const scheduleparse = useCallback((text: string) => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current)
    parseTimerRef.current = setTimeout(() => {
      setEvents(parseNote(text))
    }, 300)
  }, [])

  // ─── ComponentRelay ──────────────────────────────────────────────────────────
  useEffect(() => {
    const relay = new ComponentRelay({
      targetWindow: window,
      handleRequestForContentHeight: () => undefined,
      onReady: () => {
        const platform = relay.platform
        if (platform) {
          document.body.classList.add(platform)
        }
      },
    })

    relay.streamContextItem((note: Record<string, unknown>) => {
      noteRef.current = note

      if ((note as { isMetadataUpdate?: boolean }).isMetadataUpdate) {
        return
      }

      const content = note.content as Record<string, unknown> | undefined
      const text = typeof content?.text === 'string' ? content.text : ''

      setIsLoading(false)
      editorRef.current?.setText(text)
      scheduleparse(text)

      // Apply persisted settings from the note content
      const s = parseNoteSettings(text)
      if (s.show_calendar !== undefined) setSplitView(s.show_calendar)
      if (s.calendar_split !== undefined) setSplitRatio(100 - s.calendar_split)
      if (s.verify !== undefined) setVerifyMode(s.verify)
      if (s.calendar_mode !== undefined) setCalendarMode(s.calendar_mode)
    })

    relayRef.current = relay

    // Replay any messages that arrived before our module script loaded
    const early: MessageEvent[] = (window as any).__snEarlyMessages ?? []
    window.removeEventListener('message', (window as any).__snCapture)
    document.removeEventListener('message', (window as any).__snCapture)
    for (const e of early) {
      window.dispatchEvent(new MessageEvent('message', { data: e.data, origin: e.origin }))
    }
    ;(window as any).__snEarlyMessages = []

    // Fallback: if SN doesn't deliver a note, show the dev sample
    const fallback = setTimeout(() => {
      if (!noteRef.current) {
        setIsLoading(false)
        editorRef.current?.setText(DEV_NOTE)
        scheduleparse(DEV_NOTE)
        const s = parseNoteSettings(DEV_NOTE)
        if (s.show_calendar !== undefined) setSplitView(s.show_calendar)
        if (s.calendar_split !== undefined) setSplitRatio(100 - s.calendar_split)
        if (s.verify !== undefined) setVerifyMode(s.verify)
        if (s.calendar_mode !== undefined) setCalendarMode(s.calendar_mode)
      }
    }, 2000)

    return () => {
      clearTimeout(fallback)
      relay.deinit()
    }
  }, [scheduleparse])

  // ─── Input handler — called by TextEditor on every keystroke ───
  const handleInput = useCallback((text: string) => {
    scheduleparse(text)
    const note = noteRef.current
    if (!note || !relayRef.current) return
    relayRef.current.saveItemWithPresave(note as any, () => {
      const content = note.content as Record<string, unknown>
      content.text = text
    })
  }, [scheduleparse])

  // ─── Drag-to-resize ───
  useEffect(() => {
    const onMove = (clientX: number) => {
      if (!isDragging.current || !mainRef.current) return
      const rect = mainRef.current.getBoundingClientRect()
      const ratio = Math.max(20, Math.min(80, ((clientX - rect.left) / rect.width) * 100))
      setSplitRatio(ratio)
    }
    const onUp = (clientX: number) => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (mainRef.current) {
        const rect = mainRef.current.getBoundingClientRect()
        const ratio = Math.max(20, Math.min(80, ((clientX - rect.left) / rect.width) * 100))
        lsSet('sn-calendar-ratio', String(Math.round(ratio)))
      }
    }
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX)
    const onMouseUp = (e: MouseEvent) => onUp(e.clientX)
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX)
    const onTouchEnd = (e: TouchEvent) => onUp(e.changedTouches[0].clientX)

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }, [])

  const toggleSplit = useCallback(() => {
    setSplitView(v => {
      const next = !v
      lsSet('sn-calendar-split', String(next))
      return next
    })
  }, [])

  const switchMobileTab = useCallback((tab: MobileTab) => {
    setMobileTab(tab)
    lsSet('sn-calendar-mobile-tab', tab)
  }, [])

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      if (isMobile) {
        switchMobileTab('edit')
        setTimeout(() => {
          editorRef.current?.scrollToLine(event.lineIndex)
        }, 80)
      } else {
        editorRef.current?.scrollToLine(event.lineIndex)
      }
    },
    [isMobile, switchMobileTab],
  )

  const showEditor = !isMobile || mobileTab === 'edit'
  const showCalendar = !isMobile ? splitView : mobileTab === 'calendar'

  const calendarPanel = useMemo(
    () => <CalendarPanel ref={calendarRef} events={events} onEventClick={handleEventClick} isMobile={isMobile} calendarMode={calendarMode} />,
    [events, handleEventClick, isMobile, calendarMode],
  )

  return (
    <div className={styles.app}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.appTitle}>Calendar View</span>
        {(!isMobile || mobileTab === 'edit') && (
          <button
            className={`${styles.verifyBtn} ${verifyMode ? styles.verifyActive : ''}`}
            onClick={toggleVerify}
            title="Highlight recognized calendar entries"
          >
            Verify
          </button>
        )}
        {isMobile ? (
          <>
            {mobileTab === 'calendar' && (
              <div className={styles.toolbarNav}>
                <button className={styles.toolbarNavBtn} onClick={() => calendarRef.current?.navPrev()} aria-label="Previous">&#8592;</button>
                <button className={styles.toolbarNavBtn} onClick={() => calendarRef.current?.navNext()} aria-label="Next">&#8594;</button>
              </div>
            )}
            <div className={styles.mobileTabs}>
              <button
                className={`${styles.mobileTab} ${mobileTab === 'edit' ? styles.activeTab : ''}`}
                onClick={() => switchMobileTab('edit')}
              >
                Note
              </button>
              <button
                className={`${styles.mobileTab} ${mobileTab === 'calendar' ? styles.activeTab : ''}`}
                onClick={() => switchMobileTab('calendar')}
              >
                Calendar
              </button>
            </div>
          </>
        ) : (
          <button
            className={`${styles.splitBtn} ${splitView ? styles.splitActive : ''}`}
            onClick={toggleSplit}
            title="Toggle calendar"
          >
            Show Calendar
          </button>
        )}
      </div>

      {/* Main content */}
      <div ref={mainRef} className={styles.main}>
        <div
          className={styles.editorPane}
          style={{
            width: showCalendar ? `${splitRatio}%` : '100%',
            display: showEditor ? undefined : 'none',
          }}
        >
          <TextEditor
            ref={editorRef}
            onInput={handleInput}
            placeholder={isLoading ? 'Loading note…' : undefined}
            verifyMode={verifyMode}
            verifyLineIndices={verifyLineIndices}
          />
        </div>
        {showEditor && showCalendar && (
          <div
            className={styles.resizeHandle}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          />
        )}
        {showCalendar && (
          <div
            className={styles.calendarPane}
            style={{ width: showEditor ? `${100 - splitRatio}%` : '100%' }}
          >
            {calendarPanel}
          </div>
        )}
      </div>
    </div>
  )
}
