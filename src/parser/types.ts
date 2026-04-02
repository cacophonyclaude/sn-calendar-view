export interface CalendarEvent {
  id: string;            // stable unique ID: hash of lineIndex + raw line text
  lineIndex: number;     // 0-based line number in the note
  title: string;         // text after the delimiter
  startDate: Date;       // resolved datetime; 00:00 local if no @time
  endDate: Date;         // equals startDate for single-day events
  hasTime: boolean;      // true if @time was present
  isRange: boolean;      // true if endDate !== startDate (by calendar day)
  isMonthLevel: boolean; // true for "Month YYYY" format only
  isPast: boolean;       // true if endDate < midnight today (local)
}
