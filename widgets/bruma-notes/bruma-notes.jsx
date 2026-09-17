// Notes — 2x1, native macOS Notes widget look.
// The most recently edited note: title, first lines, and when it changed.
//
// Reads Notes.app over AppleScript: macOS asks once for permission to control
// Notes (System Settings → Privacy & Security → Automation).
//
// The command never launches Notes: if the app is not running it prints
// "not-running" and the widget asks the user to open it. (A `tell application`
// block would otherwise start the app — e.g. whenever the gallery renders
// its previews.)
export const command = `
if ! pgrep -x Notes > /dev/null 2>&1; then echo not-running; exit 0; fi
osascript <<'APPLESCRIPT' 2>/dev/null | tr '\\n' '\\r'
tell application "Notes"
  set out to ""
  try
    set n to note 1
    set out to (name of n) & "@@F@@" & (plaintext of n) & "@@F@@" & ((modification date of n) as «class isot» as string)
  end try
  return out
end tell
APPLESCRIPT
`;

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 606px;
  left: 20px;
  width: 366px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 18px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --fg3: rgba(0,0,0,0.34);
  --yellow: #E6A400;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --yellow: #FFD60A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .head { display: flex; align-items: center; gap: 6px; }
  .app { font-size: 13px; font-weight: 600; color: var(--yellow); }
  .when { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--fg3); }
  .title {
    margin-top: 4px;
    font-size: 15px; font-weight: 700; line-height: 18px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .body {
    margin-top: 3px;
    font-size: 12px; font-weight: 500; line-height: 16px; color: var(--fg2);
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
  }
  .empty { margin: auto; font-size: 12px; font-weight: 500; color: var(--fg2); text-align: center; }
`;

const ago = (d) => {
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export const render = ({ output }) => {
  const notRunning = (output || "").trim() === "not-running";
  // The command turns newlines into \r so the note survives as one line.
  const raw = (output || "").replace(/\r/g, "\n").trim();
  const [title, bodyRaw, iso] = notRunning ? [] : raw.split("@@F@@");

  if (!title)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="head"><span className="app">Notes</span></div>
        <div className="empty">{notRunning ? "Open Notes to see your latest note" : "No notes yet"}</div>
      </div>
    );

  // Notes repeats the title as the first line of the body; drop it.
  const body = (bodyRaw || "")
    .split("\n")
    .filter((l, i) => !(i === 0 && l.trim() === title.trim()))
    .join("\n")
    .trim();
  const when = iso ? new Date(iso) : null;

  return (
    <div>
      <div className="head">
        <span className="app">Notes</span>
        <span className="when">{when && !isNaN(when) ? ago(when) : ""}</span>
      </div>
      <div className="title">{title}</div>
      <div className="body">{body}</div>
    </div>
  );
};
