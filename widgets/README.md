# Widgets

Ready-to-use widgets for bruma. Each folder is a self-contained widget.

## macOS look

Widgets that borrow the native widget language: Liquid Glass panel, SF-style
type, system accent colours. Between them they cover the desktop widgets macOS
ships — clock, calendar, weather, batteries, reminders, notes, mail, music,
stocks, news, screen time, photos and tips — plus a few
bruma extras.

### 1x1

| Widget | What it does |
|---|---|
| [`bruma-clock`](bruma-clock/) | Analog clock with a Liquid Glass background; colors follow the system theme. |
| [`bruma-digital-clock`](bruma-digital-clock/) | The digital face: big HH:MM, ticking seconds, weekday and date, and a twelve-block minute bar. |
| [`bruma-date`](bruma-date/) | Large day of the month, with 12 dial-style ticks pointing at the current month. |
| [`bruma-weather`](bruma-weather/) | Current conditions: temperature, drawn pictogram, description and the day's high/low. |
| [`bruma-battery`](bruma-battery/) | This Mac's charge as a ring, with the state pmset reports (charging, time left…). |
| [`bruma-stock`](bruma-stock/) | One symbol: price, change and the day's line chart against yesterday's close. |
| [`bruma-photo`](bruma-photo/) | A random picture from a folder, refreshed every half hour, under a soft gradient. |
| [`bruma-tips`](bruma-tips/) | One macOS tip a day, picked by the day of the year. |

### 2x1

| Widget | What it does |
|---|---|
| [`bruma-world-clock`](bruma-world-clock/) | Four cities as analog dials; each face goes dark while it is night there. |
| [`bruma-calendar`](bruma-calendar/) | Up Next: the next events from your calendars over the coming two days. |
| [`bruma-calendar-month`](bruma-calendar-month/) | The whole month as a grid, today in a red disc, weekends dimmed. |
| [`bruma-weather-forecast`](bruma-weather-forecast/) | Current conditions plus the next six three-hour slots. |
| [`bruma-batteries`](bruma-batteries/) | A ring for the Mac plus a bar per connected device that reports a battery. |
| [`bruma-reminders`](bruma-reminders/) | Open reminders, soonest due first, overdue ones in red. |
| [`bruma-notes`](bruma-notes/) | The most recently edited note: title, first lines, and when it changed. |
| [`bruma-mail`](bruma-mail/) | Unread count plus the newest messages in the inbox. |
| [`bruma-music`](bruma-music/) | Now playing in Spotify or Music: artwork, track, artist and progress. |
| [`bruma-stocks`](bruma-stocks/) | A watchlist: symbol, name, last price and the day's change as a coloured pill. |
| [`bruma-news`](bruma-news/) | Top stories from any RSS feed. |
| [`bruma-screen-time`](bruma-screen-time/) | Today's app usage as bars, read from the system knowledge store. |
| [`bruma-cpu`](bruma-cpu/) | CPU usage over the last ~2 minutes (area + line). |
| [`bruma-claude`](bruma-claude/) | Claude Code usage: one square per day, one column per week, plus total messages and current streak. |

### No panel

| Widget | What it does |
|---|---|
| [`bruma-binary`](bruma-binary/) | Binary clock (BCD): a grid of white dots, one column per digit of HH:MM:SS. No background, straight on the wallpaper. |

### What each one needs

Most of them only need the machine itself. These are the exceptions:

| Widget | Needs |
|---|---|
| `bruma-calendar`, `bruma-reminders` | Access to Calendars / Reminders, read through EventKit — the apps are never launched. macOS asks once (System Settings → Privacy & Security → Calendars / Reminders); until it is granted the widget says so. |
| `bruma-notes`, `bruma-mail`, `bruma-music` | Permission to control the app over AppleScript. macOS asks once (System Settings → Privacy & Security → Automation); until it is granted the widget shows its empty state instead of data. |
| `bruma-screen-time` | Full Disk Access for bruma.app — the usage store (`knowledgeC.db`) is protected. Without it the widget says so. |
| `bruma-weather`, `bruma-weather-forecast` | Network. They call [wttr.in](https://wttr.in) (free, no key) every 15 min. `LOCATION` at the top of the file: empty means "wherever this IP is". |
| `bruma-stock`, `bruma-stocks` | Network. Yahoo Finance's public chart endpoint. Edit `SYMBOL` / `SYMBOLS`. |
| `bruma-news` | Network. Edit `FEED` — any RSS/Atom URL. |
| `bruma-photo` | A folder of images in `PHOTO_DIR` (default `~/Pictures`). The Photos library itself is a sealed bundle and is skipped. |
| `bruma-world-clock`, `bruma-digital-clock` | Nothing, but the zone list (`ZONES`, `TZ`) at the top of the file is worth editing. |

The widgets that parse JSON use `jq` and the news one uses `xmllint`; both ship
with macOS.

## Nothing look

A pack of eighteen widgets in the Nothing OS idiom: flat black or white panels,
dot-matrix lettering, one red accent, everything else in dots. They are inspired
by the [Nothing OS widgets][figma] community file and extended well past it.

[figma]: https://www.figma.com/community/file/1125329683977310981/nothing-os-widgets

| Widget | Size | What it does |
|---|---|---|
| [`nothing-clock`](nothing-clock/) | 2×1 | Dot-matrix HH:MM over a ghosted dot grid, weekday and date above, a 60-dot second bar below. |
| [`nothing-dial`](nothing-dial/) | 1×1 | Ring of 60 dots that fills over the minute, digital time in the middle, red dot on the current second. |
| [`nothing-date`](nothing-date/) | 1×1 | Big day of the month; the bottom row is the month, one dot per day, today in red. |
| [`nothing-calendar`](nothing-calendar/) | 2×1 | The month as a 7×6 dot grid, Monday first: past days filled, today red. |
| [`nothing-world`](nothing-world/) | 2×1 | Three time zones with their weekday. Edit the zones and their labels at the top of the file. |
| [`nothing-countdown`](nothing-countdown/) | 1×1 | Days left until a date you set (`TARGET`, `TITLE`); counts up again once it passes. |
| [`nothing-cpu`](nothing-cpu/) | 2×1 | CPU load as a dot column chart, one column per 2-second sample, newest column in red. |
| [`nothing-memory`](nothing-memory/) | 1×1 | RAM in use on a dot ring, with free gigabytes under the percentage. |
| [`nothing-disk`](nothing-disk/) | 1×1 | Same ring for the data volume, with free gigabytes. |
| [`nothing-battery`](nothing-battery/) | 2×1 | Charge as dot-matrix type plus a dotted battery pictogram; turns red while charging. |
| [`nothing-network`](nothing-network/) | 2×1 | Down/up throughput on two log-scale dot meters, from the interface byte counters. |
| [`nothing-uptime`](nothing-uptime/) | 1×1 | How long the Mac has been up, as HH:MM plus a day count. |
| [`nothing-glyph`](nothing-glyph/) | 2×1 | The Phone (1) Glyph Interface laid out landscape; arc, ring, bar and the eight segments light up with the load average. |
| [`nothing-weather`](nothing-weather/) | 2×1 | Temperature, conditions, humidity and wind from wttr.in, with a dot-art weather icon. |
| [`nothing-sun`](nothing-sun/) | 1×1 | Daylight arc between sunrise and sunset, red dot on the current time, hours of light left. |
| [`nothing-moon`](nothing-moon/) | 1×1 | Moon phase as a dot disc, computed from the date — no network needed. |
| [`nothing-playing`](nothing-playing/) | 2×1 | Track, artist and progress from Spotify or Music, whichever is playing. |
| [`nothing-ticker`](nothing-ticker/) | 2×½ | A wide strip that scrolls one line of dot-matrix text: put any command in it. |

### How the Nothing widgets are built

- **Type is drawn, not loaded.** Ndot isn't a system font and the pack ships no
  font file, so each widget carries a small 5×7 dot font (`FONT_KEYS` /
  `FONT_ROWS`, seven base32 characters per glyph) and a `<Type>` component that
  paints it as SVG circles. `s` is the dot pitch in pixels, `ghost` also paints
  the unlit dots — that is what gives `nothing-clock` its display look. The
  block is identical in every widget on purpose: a widget is one file you can
  copy on its own.
- **Four colours.** `--on`, `--off` (unlit dots), `--dim` (labels) and `--red`
  (`#D71921`, the Nothing accent, used for exactly one thing per widget). They
  flip with `prefers-color-scheme`, so the panels are black on white by day and
  white on black at night.
- **No Liquid Glass.** These panels are deliberately flat (`background:
  var(--bg)`), because a frosted panel is the opposite of the look. The
  `bruma-*` widgets above are the ones that use the native material.
- **Sizes.** 1×1 is 170×170, 2×1 is 356×170, the ticker is a 356×92 strip —
  the same grid as the macOS-look widgets, so the two families line up.

### Widgets you may want to edit

| Widget | Edit |
|---|---|
| `nothing-weather`, `nothing-sun` | `LOCATION` at the top of the file — empty means "wherever this IP is". Both call [wttr.in](https://wttr.in), a free service, every 15 minutes; without a network they say so and keep going. |
| `nothing-world` | The zone list in `command` and the `LABELS` array below it, in the same order. |
| `nothing-countdown` | `TARGET` (`YYYY-MM-DD`) and `TITLE`. |
| `nothing-ticker` | `command` — its first line is what scrolls. |
| `nothing-playing` | Nothing to edit, but macOS asks once for permission to control Spotify/Music. Until you grant it, the widget shows `NOTHING`. |

## Install

Copy the widget folder into bruma's widgets folder:

```bash
cp -R nothing-clock ~/Library/Application\ Support/Bruma/widgets/
```

Or, from the menu bar: **Open Widgets Folder** → drag the folder in there. bruma picks
up the change and loads the widget right away (hot-reload), no restart needed.

To install a whole family at once:

```bash
cp -R bruma-* ~/Library/Application\ Support/Bruma/widgets/
```

```bash
cp -R nothing-* ~/Library/Application\ Support/Bruma/widgets/
```

If you don't have the repo cloned, you can download a single widget from GitHub:
open the widget folder, open the `.jsx`, hit **Raw** → save it as
`widget-name/widget-name.jsx` inside the widgets folder.

## Placement

Every widget ships with a default position (`top`/`left` in its `className`). To move it,
use the **edit mode** from the menu bar (**Edit Widgets…**) and drag it; the position is
saved on its own.

In edit mode, the 3×3 dot badge picks the **anchor**: the point of the widget that pins the
saved position, and the point it grows from when its size changes (top-left corner by
default). Handy for widgets whose content grows by itself: with the anchor at the
bottom-right corner, for example, that corner stays put and the widget expands up and to
the left.

The widgets are meant to be laid out as a macOS-style grid, 1×1 and 2×1 tiles with
16 px of spacing. The defaults already spread the two families over separate rows,
so dropping several on the desktop gives you something sane to drag from. With
this many `bruma-*` presets the default grid runs wider and taller than a laptop
screen on purpose — place the ones you want and drag them where you like rather
than dropping all of them at once.
