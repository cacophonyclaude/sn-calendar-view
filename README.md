# Calendar View

A [Standard Notes](https://standardnotes.org/) editor plugin that turns plain-text date entries in your notes into a live calendar. Write events in a simple natural-language format; the calendar updates as you type.

## Features

- **Month and week views** with navigation and a Today button
- **Split view on desktop**: editor on the left, calendar on the right, with a draggable divider
- **Tab view on mobile**: switch between Edit and Calendar tabs
- **Click any event** in the calendar to jump to that line in the editor
- **Live sync**: the calendar updates as you type (300ms debounce)
- Past events and past days are visually de-emphasized

## Writing Events

Each event is a single line in the format:

```
<date> - <title>
```

or with a colon separator:

```
<date> : <title>
```

Lines that don't match this format are ignored — you can freely mix regular notes, headings, and separators alongside your events. You can use the "Verify" toggle button at the top to confirm that all your lines with dates are correctly interpreted as date entries.

### Date Formats

| Format | Examples |
|--------|---------|
| ISO date | `2026-03-15`, `2027-06-01` |
| Numeric with year | `3/15/2026`, `3-15-26` |
| Month name with year | `March 15 2026`, `Mar 15th 2026` |
| Numeric without year | `3/15`, `3-15` |
| Month name without year | `March 15`, `Mar 15th` |
| Weekday | `Monday`, `Friday`, `next Wednesday` |
| Month only | `March 2027` |
| Time only | `@3pm`, `@9:30am` |

When no year is given, the nearest future date is assumed. `next <weekday>` always refers to the following calendar week.

### Adding a Time

Append `@time` to any date:

```
March 15 @3pm - Dentist
4/1/2026 @9:30am - Team standup
Monday @2pm - Call with Alice
```

Supported time formats: `@3pm`, `@14:00`, `@9:30am`, `@2:30pm`

### Date Ranges

Separate start and end dates with ` - `:

```
March 15 - March 20 - Spring break
2026-06-01 - 2026-06-07 - Conference
```

Multi-day events display as a continuous bar spanning all covered days in the calendar.

### Examples

```
My Calendar

March 15 - March 20 - Spring break
3/25/2026 @9am - Dentist appointment
April 1 - April Fools Day
next Monday - Project deadline
Friday @3:30pm - Team sync
May 2026 - Vacation month

-------

TODO
- Buy groceries
- Call mom
```

## Settings

You can persist per-note settings by adding a line anywhere in the note:

```
@settings key=value key=value ...
```

Only the first `@settings` line in the note is used. Settings are applied each time the note loads.

| Setting | Values | Default | Description |
|---------|--------|---------|-------------|
| `show_calendar` | `true` / `false` | `true` | Show or hide the calendar pane |
| `calendar_split` | `20`–`80` | `65` | Percentage of width given to the calendar |
| `calendar_mode` | `month` / `week` | `month` | Which view to open in |
| `verify` | `true` / `false` | `false` | Enable the Verify highlight on load |

Example:

```
@settings show_calendar=true calendar_split=65 calendar_mode=week verify=false
```

## Installation

1. In Standard Notes, open **Preferences**, navigate to **Plugins**, and scroll down to **Install Custom Plugin**
2. Enter the following URL:

```
https://bytebeet.github.io/sn-calendar-view/ext.json
```

3. Activate the plugin on any note by selecting **Calendar View** from the editor menu

## Licenses

**Roboto Slab** font by Christian Robertson, licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). The font file is self-hosted as a latin-subset woff2.

## Development

```bash
npm install
npm run dev       # start dev server
npm run build     # production build
npm run test      # run tests
```
