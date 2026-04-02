export interface NoteSettings {
  show_calendar?: boolean
  calendar_split?: number   // percentage given to the calendar (20–80)
  calendar_mode?: 'month' | 'week'
  verify?: boolean
}

/** Scans note text for the first line matching "@settings key=value ..." and returns parsed values. */
export function parseNoteSettings(text: string): NoteSettings {
  const settings: NoteSettings = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*@settings\s+(.+)$/i)
    if (!match) continue

    for (const pair of match[1].trim().split(/\s+/)) {
      const eq = pair.indexOf('=')
      if (eq < 1) continue
      const key = pair.slice(0, eq).trim().toLowerCase()
      const val = pair.slice(eq + 1).trim().toLowerCase()

      if (key === 'show_calendar') {
        settings.show_calendar = val !== 'false'
      } else if (key === 'calendar_split') {
        const n = parseInt(val, 10)
        if (!isNaN(n) && n >= 20 && n <= 80) settings.calendar_split = n
      } else if (key === 'calendar_mode') {
        if (val === 'month' || val === 'week') settings.calendar_mode = val
      } else if (key === 'verify') {
        settings.verify = val !== 'false'
      }
    }
    break // only the first settings line is used
  }
  return settings
}
