// Month name maps — full and abbreviated, case-insensitive
export const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
  sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

export const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, weds: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

// Ordinal suffix: 1st, 2nd, 3rd, 4th, 21st etc.
export const ORDINAL_RE = /^(\d+)(?:st|nd|rd|th)$/i

// @time regex: matches @3pm, @9am, @2:30pm, @14:30, @9, @12am, @12pm
export const TIME_RE = /@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i

// Priority 1: ISO date YYYY-MM-DD
export const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

// Priority 2: numeric with explicit year
export const NUM_YEAR_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/

// Priority 3: Month name with optional year
export const MONTH_NAME_YEAR_RE = /^([a-z]+)\s+(\d{1,2}(?:st|nd|rd|th)?)\s+(\d{4})$/i
export const MONTH_ONLY_RE = /^([a-z]+)\s+(\d{4})$/i

// Priority 4: numeric without year (MM/DD or MM-DD)
export const NUM_NO_YEAR_RE = /^(\d{1,2})[\/\-](\d{1,2})$/

// Priority 5: Month name without year
export const MONTH_NAME_DAY_RE = /^([a-z]+)\s+(\d{1,2}(?:st|nd|rd|th)?)$/i

// Priority 6: weekday
export const NEXT_WEEKDAY_RE = /^next\s+([a-z]+)\.?$/i
export const WEEKDAY_RE = /^([a-z]+)\.?$/i

// Priority 7: time only
export const TIME_ONLY_RE = /^@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i
