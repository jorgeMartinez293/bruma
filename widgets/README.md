# Widgets

Ready-to-use widgets for bruma. Each folder is a self-contained widget.

| Widget | What it does |
|---|---|
| [`bruma-clock`](bruma-clock/) | 1×1 analog clock with a Liquid Glass background; colors follow the system theme. |
| [`bruma-date`](bruma-date/) | Large day of the month, with 12 dial-style ticks pointing at the current month, 1×1, Liquid Glass. |
| [`bruma-cpu`](bruma-cpu/) | CPU usage over the last ~2 minutes (area + line), 2×1, Liquid Glass. |
| [`bruma-claude`](bruma-claude/) | Claude Code usage: one square per day, one column per week, plus total messages and current streak, 2×1, Liquid Glass. |
| [`bruma-binary`](bruma-binary/) | Binary clock (BCD): a grid of white dots, one column per digit of HH:MM:SS. No background, straight on the wallpaper. |

## Install

Copy the widget folder into bruma's widgets folder:

```bash
cp -R bruma-clock ~/Library/Application\ Support/Bruma/widgets/
```

Or, from the menu bar: **Open Widgets Folder** → drag the folder in there. bruma picks
up the change and loads the widget right away (hot-reload), no restart needed.

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

The widgets are meant to be laid out as a macOS-style grid: `bruma-clock` and `bruma-date`
on top (1×1 each), `bruma-cpu` below (2×1), and `bruma-claude` under it (2×1), with 16 px
of spacing.
