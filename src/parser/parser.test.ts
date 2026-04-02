import { describe, it, expect } from 'vitest'
import { parseSingleDate } from './parser'
import { parseNote } from './parser'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }
}

function hm(d: Date) {
  return { h: d.getHours(), min: d.getMinutes() }
}

const today = new Date()
today.setHours(0, 0, 0, 0)

const tomorrow = new Date(today)
tomorrow.setDate(today.getDate() + 1)

// ─── parseSingleDate ─────────────────────────────────────────────────────────

describe('parseSingleDate', () => {
  // Priority 1 — ISO date
  describe('ISO date', () => {
    it('parses YYYY-MM-DD', () => {
      const r = parseSingleDate('2025-06-15')!
      expect(r).not.toBeNull()
      expect(ymd(r.date)).toEqual({ y: 2025, m: 5, d: 15 })
      expect(r.hasTime).toBe(false)
    })

    it('never rolls ISO date forward', () => {
      const r = parseSingleDate('2000-01-01')!
      expect(ymd(r.date)).toEqual({ y: 2000, m: 0, d: 1 })
    })

    it('parses ISO date with @time', () => {
      const r = parseSingleDate('2025-06-15 @3pm')!
      expect(ymd(r.date)).toEqual({ y: 2025, m: 5, d: 15 })
      expect(hm(r.date)).toEqual({ h: 15, min: 0 })
      expect(r.hasTime).toBe(true)
    })
  })

  // Priority 2 — numeric with explicit year
  describe('numeric with explicit year', () => {
    it('parses MM/DD/YYYY', () => {
      const r = parseSingleDate('4/15/2026')!
      expect(ymd(r.date)).toEqual({ y: 2026, m: 3, d: 15 })
    })

    it('parses MM/DD/YY (00-69 → 2000s)', () => {
      const r = parseSingleDate('4/15/27')!
      expect(r.date.getFullYear()).toBe(2027)
    })

    it('parses MM/DD/YY (70-99 → 1900s)', () => {
      const r = parseSingleDate('4/15/85')!
      expect(r.date.getFullYear()).toBe(1985)
    })

    it('parses MM-DD-YYYY', () => {
      const r = parseSingleDate('04-15-2026')!
      expect(ymd(r.date)).toEqual({ y: 2026, m: 3, d: 15 })
    })
  })

  // Priority 3 — Month name with year
  describe('month name with year', () => {
    it('parses Month DD YYYY', () => {
      const r = parseSingleDate('April 15 2026')!
      expect(ymd(r.date)).toEqual({ y: 2026, m: 3, d: 15 })
    })

    it('parses Month DDth YYYY (ordinal)', () => {
      const r = parseSingleDate('April 2nd 2027')!
      expect(ymd(r.date)).toEqual({ y: 2027, m: 3, d: 2 })
    })

    it('parses Month YYYY → month-level, 1st of month', () => {
      const r = parseSingleDate('March 2027')!
      expect(ymd(r.date)).toEqual({ y: 2027, m: 2, d: 1 })
      expect(r.isMonthLevel).toBe(true)
      expect(r.hasTime).toBe(false)
    })
  })

  // Priority 4 — numeric without year
  describe('numeric without year — year inference', () => {
    it('future date stays this year', () => {
      // Use a date far in the future this year
      const futureMonth = 11 // December
      const r = parseSingleDate(`12/25`)!
      const thisYear = new Date().getFullYear()
      const dec25ThisYear = new Date(thisYear, 11, 25)
      dec25ThisYear.setHours(0, 0, 0, 0)
      if (today <= dec25ThisYear) {
        expect(r.date.getFullYear()).toBe(thisYear)
      } else {
        expect(r.date.getFullYear()).toBe(thisYear + 1)
      }
      expect(r.date.getMonth()).toBe(futureMonth)
      expect(r.date.getDate()).toBe(25)
    })

    it('past date rolls to next year', () => {
      // Jan 1 is always in the past unless today is Jan 1
      const r = parseSingleDate('1/1')!
      const jan1 = new Date(today.getFullYear(), 0, 1)
      if (today <= jan1) {
        expect(r.date.getFullYear()).toBe(today.getFullYear())
      } else {
        expect(r.date.getFullYear()).toBe(today.getFullYear() + 1)
      }
    })

    it('parses MM-DD without year', () => {
      const r = parseSingleDate('12-25')!
      expect(r.date.getMonth()).toBe(11)
      expect(r.date.getDate()).toBe(25)
    })
  })

  // Priority 5 — Month name without year
  describe('month name without year', () => {
    it('parses Month DD', () => {
      const r = parseSingleDate('December 25')!
      expect(r.date.getMonth()).toBe(11)
      expect(r.date.getDate()).toBe(25)
    })

    it('parses Month DDst (ordinal)', () => {
      const r = parseSingleDate('April 1st')!
      expect(r.date.getMonth()).toBe(3)
      expect(r.date.getDate()).toBe(1)
    })
  })

  // Priority 6 — weekday
  describe('weekday', () => {
    it('parses a full weekday name', () => {
      const r = parseSingleDate('Monday')!
      expect(r).not.toBeNull()
      expect(r.date.getDay()).toBe(1)
      expect(r.date >= today).toBe(true)
    })

    it('parses abbreviated weekday', () => {
      const r = parseSingleDate('Mon')!
      expect(r.date.getDay()).toBe(1)
    })

    it('parses Thurs abbreviation', () => {
      const r = parseSingleDate('Thurs')!
      expect(r.date.getDay()).toBe(4)
    })

    it('accepts trailing period', () => {
      const r = parseSingleDate('Fri.')!
      expect(r.date.getDay()).toBe(5)
    })

    it('next weekday is in the following calendar week', () => {
      const r = parseSingleDate('next Friday')!
      expect(r.date.getDay()).toBe(5)
      // Must be strictly after the current week's Sunday
      const dayOfWeek = today.getDay()
      const sundayOffset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
      const thisSunday = new Date(today)
      thisSunday.setDate(today.getDate() + sundayOffset)
      expect(r.date > thisSunday).toBe(true)
    })
  })

  // Priority 7 — time only
  describe('time only', () => {
    it('parses @3pm as today at 15:00', () => {
      const r = parseSingleDate('@3pm')!
      expect(r.hasTime).toBe(true)
      expect(hm(r.date)).toEqual({ h: 15, min: 0 })
    })

    it('parses @12am as midnight', () => {
      const r = parseSingleDate('@12am')!
      expect(hm(r.date)).toEqual({ h: 0, min: 0 })
    })

    it('parses @12pm as noon', () => {
      const r = parseSingleDate('@12pm')!
      expect(hm(r.date)).toEqual({ h: 12, min: 0 })
    })

    it('parses @2:30pm', () => {
      const r = parseSingleDate('@2:30pm')!
      expect(hm(r.date)).toEqual({ h: 14, min: 30 })
    })

    it('parses @14:30 (24h)', () => {
      const r = parseSingleDate('@14:30')!
      expect(hm(r.date)).toEqual({ h: 14, min: 30 })
    })

    it('parses @9 (bare int)', () => {
      const r = parseSingleDate('@9')!
      expect(hm(r.date)).toEqual({ h: 9, min: 0 })
    })
  })

  // @time on date tokens
  describe('@time suffix on date tokens', () => {
    it('Thurs @3pm', () => {
      const r = parseSingleDate('Thurs @3pm')!
      expect(r.hasTime).toBe(true)
      expect(r.date.getDay()).toBe(4)
      expect(hm(r.date)).toEqual({ h: 15, min: 0 })
    })

    it('Mon @9am', () => {
      const r = parseSingleDate('Mon @9am')!
      expect(hm(r.date)).toEqual({ h: 9, min: 0 })
    })

    it('next Friday @2pm', () => {
      const r = parseSingleDate('next Friday @2pm')!
      expect(r.date.getDay()).toBe(5)
      expect(hm(r.date)).toEqual({ h: 14, min: 0 })
    })
  })
})

// ─── parseNote — full line parsing ───────────────────────────────────────────

describe('parseNote', () => {
  it('skips blank lines', () => {
    const events = parseNote('\n\n')
    expect(events).toHaveLength(0)
  })

  it('skips lines with no date', () => {
    const events = parseNote('My Calendar Note\nJust a reminder')
    expect(events).toHaveLength(0)
  })

  it('parses basic event', () => {
    const events = parseNote('Thurs @3pm - Dentist')
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Dentist')
    expect(events[0].hasTime).toBe(true)
  })

  it('parses colon delimiter', () => {
    const events = parseNote('Mon @9am: Call accountant')
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Call accountant')
  })

  it('assigns correct lineIndex', () => {
    const events = parseNote('Not a date\nMon - Meeting\nAlso not a date')
    expect(events).toHaveLength(1)
    expect(events[0].lineIndex).toBe(1)
  })

  it('generates stable IDs', () => {
    const text = 'Mon - Meeting'
    const e1 = parseNote(text)
    const e2 = parseNote(text)
    expect(e1[0].id).toBe(e2[0].id)
  })

  it('isPast true for past events', () => {
    const events = parseNote('2000-01-01 - Old event')
    expect(events[0].isPast).toBe(true)
  })

  it('isPast false for future events', () => {
    const events = parseNote('2099-12-31 - Future event')
    expect(events[0].isPast).toBe(false)
  })

  // ─── Range tests ─────────────────────────────────────────────────────────

  describe('ranges', () => {
    it('4/2-4/12 - Vacation', () => {
      const events = parseNote('4/2-4/12 - Vacation')
      expect(events).toHaveLength(1)
      const e = events[0]
      expect(e.isRange).toBe(true)
      expect(e.title).toBe('Vacation')
      expect(e.startDate.getMonth()).toBe(3)
      expect(e.startDate.getDate()).toBe(2)
      expect(e.endDate.getMonth()).toBe(3)
      expect(e.endDate.getDate()).toBe(12)
    })

    it('4/2 - 4/12 - Vacation', () => {
      const events = parseNote('4/2 - 4/12 - Vacation')
      expect(events).toHaveLength(1)
      expect(events[0].isRange).toBe(true)
      expect(events[0].title).toBe('Vacation')
    })

    it('April 2-April 12 - Vacation', () => {
      const events = parseNote('April 2-April 12 - Vacation')
      expect(events).toHaveLength(1)
      expect(events[0].isRange).toBe(true)
      expect(events[0].startDate.getDate()).toBe(2)
      expect(events[0].endDate.getDate()).toBe(12)
    })

    it('April 2nd-April 12th - Vacation', () => {
      const events = parseNote('April 2nd-April 12th - Vacation')
      expect(events).toHaveLength(1)
      expect(events[0].isRange).toBe(true)
    })

    it('April 2nd 2027-April 12th 2027 - Future trip', () => {
      const events = parseNote('April 2nd 2027-April 12th 2027 - Future trip')
      expect(events).toHaveLength(1)
      const e = events[0]
      expect(e.isRange).toBe(true)
      expect(e.startDate.getFullYear()).toBe(2027)
      expect(e.endDate.getFullYear()).toBe(2027)
      expect(e.title).toBe('Future trip')
    })

    it('2026-04-02-2026-04-12 - Trip', () => {
      const events = parseNote('2026-04-02-2026-04-12 - Trip')
      expect(events).toHaveLength(1)
      const e = events[0]
      expect(e.isRange).toBe(true)
      expect(e.startDate.getFullYear()).toBe(2026)
      expect(e.startDate.getDate()).toBe(2)
      expect(e.endDate.getDate()).toBe(12)
      expect(e.title).toBe('Trip')
    })

    it('isPast false for in-progress range', () => {
      // A range that started in the past but ends far in future
      const events = parseNote('2000-01-01-2099-12-31 - Long range')
      expect(events[0].isPast).toBe(false)
    })
  })

  // ─── Sample fallback note ─────────────────────────────────────────────────

  describe('sample fallback note', () => {
    const SAMPLE = `My Calendar Note

Thurs @3pm - Dentist
Mon @9am - Call accountant
4/15 - Tax deadline
next Friday @2pm - Team lunch
April 2-April 12 - Vacation
March 2027 - Pay quarterly taxes
2027-06-15 - Conference
Sat - Grocery run
@11am - Morning standup`

    it('parses all event lines', () => {
      const events = parseNote(SAMPLE)
      expect(events.length).toBe(9)
    })

    it('skips title line', () => {
      const events = parseNote(SAMPLE)
      expect(events.some(e => e.title === 'My Calendar Note')).toBe(false)
    })

    it('Vacation is a range', () => {
      const events = parseNote(SAMPLE)
      const vacation = events.find(e => e.title === 'Vacation')!
      expect(vacation.isRange).toBe(true)
    })

    it('March 2027 is month-level', () => {
      const events = parseNote(SAMPLE)
      const taxes = events.find(e => e.title === 'Pay quarterly taxes')!
      expect(taxes.isMonthLevel).toBe(true)
    })

    it('Conference has explicit 2027 date', () => {
      const events = parseNote(SAMPLE)
      const conf = events.find(e => e.title === 'Conference')!
      expect(conf.startDate.getFullYear()).toBe(2027)
      expect(conf.startDate.getMonth()).toBe(5)
      expect(conf.startDate.getDate()).toBe(15)
    })
  })
})
