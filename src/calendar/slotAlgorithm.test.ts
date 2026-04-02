import { describe, it, expect } from 'vitest'
import { assignSlots } from './slotAlgorithm'
import type { CalendarEvent } from '../parser/types'

function makeEvent(overrides: Partial<CalendarEvent> & { startDate: Date; endDate: Date }): CalendarEvent {
  return {
    id: Math.random().toString(36),
    lineIndex: 0,
    title: 'Test',
    hasTime: false,
    isRange: false,
    isMonthLevel: false,
    isPast: false,
    ...overrides,
  }
}

// Week: Mon Apr 7 – Sun Apr 13, 2025
const weekStart = new Date(2025, 3, 7, 0, 0, 0, 0) // Mon
const weekEnd = new Date(2025, 3, 13, 0, 0, 0, 0)  // Sun

describe('assignSlots', () => {
  it('assigns slot 0 to a single event', () => {
    const e = makeEvent({
      startDate: new Date(2025, 3, 8),
      endDate: new Date(2025, 3, 8),
    })
    const result = assignSlots([e], weekStart, weekEnd)
    expect(result).toHaveLength(1)
    expect(result[0].slot).toBe(0)
  })

  it('two non-overlapping events both get slot 0', () => {
    const e1 = makeEvent({ startDate: new Date(2025, 3, 7), endDate: new Date(2025, 3, 7) })
    const e2 = makeEvent({ startDate: new Date(2025, 3, 9), endDate: new Date(2025, 3, 9) })
    const result = assignSlots([e1, e2], weekStart, weekEnd)
    expect(result.find(r => r.id === e1.id)!.slot).toBe(0)
    expect(result.find(r => r.id === e2.id)!.slot).toBe(0)
  })

  it('two overlapping events get different slots', () => {
    const e1 = makeEvent({ startDate: new Date(2025, 3, 7), endDate: new Date(2025, 3, 10) })
    const e2 = makeEvent({ startDate: new Date(2025, 3, 8), endDate: new Date(2025, 3, 8) })
    const result = assignSlots([e1, e2], weekStart, weekEnd)
    const slots = result.map(r => r.slot)
    expect(slots).toContain(0)
    expect(slots).toContain(1)
  })

  it('longer event assigned before shorter (slot 0)', () => {
    const long = makeEvent({ startDate: new Date(2025, 3, 7), endDate: new Date(2025, 3, 13), id: 'long' })
    const short = makeEvent({ startDate: new Date(2025, 3, 7), endDate: new Date(2025, 3, 7), id: 'short' })
    const result = assignSlots([short, long], weekStart, weekEnd)
    expect(result.find(r => r.id === 'long')!.slot).toBe(0)
    expect(result.find(r => r.id === 'short')!.slot).toBe(1)
  })

  it('colStart clamped to 0 for events starting before week', () => {
    const e = makeEvent({ startDate: new Date(2025, 3, 1), endDate: new Date(2025, 3, 8) })
    const result = assignSlots([e], weekStart, weekEnd)
    expect(result[0].colStart).toBe(0)
  })

  it('colSpan clamped for events ending after week', () => {
    const e = makeEvent({ startDate: new Date(2025, 3, 10), endDate: new Date(2025, 3, 20) })
    const result = assignSlots([e], weekStart, weekEnd)
    expect(result[0].colStart + result[0].colSpan - 1).toBeLessThanOrEqual(6)
  })

  it('filters out events not in this week', () => {
    const e = makeEvent({ startDate: new Date(2025, 3, 20), endDate: new Date(2025, 3, 25) })
    const result = assignSlots([e], weekStart, weekEnd)
    expect(result).toHaveLength(0)
  })

  it('colStart and colSpan are correct for a mid-week single day', () => {
    // Wednesday Apr 9 = col 2 (Mon=0)
    const e = makeEvent({ startDate: new Date(2025, 3, 9), endDate: new Date(2025, 3, 9) })
    const result = assignSlots([e], weekStart, weekEnd)
    expect(result[0].colStart).toBe(2)
    expect(result[0].colSpan).toBe(1)
  })
})
