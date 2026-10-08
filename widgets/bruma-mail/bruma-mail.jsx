// Mail — 2x2, native macOS Mail widget look.
// Unread count plus the newest messages in the inbox, separated by thin white
// lines. The list scrolls; clicking a message unfolds its text and marks it read.
//
// Reads Mail.app over AppleScript: macOS asks once for permission to control
// Mail (System Settings → Privacy & Security → Automation).
//
// The command never launches Mail: if the app is not running it prints
// "not-running" and the widget asks the user to open it. (A `tell application`
// block would otherwise start the app — e.g. whenever the gallery renders
// its previews.)
import { useState } from "react";
import { run } from "uebersicht";

export const command = `
if ! pgrep -x Mail > /dev/null 2>&1; then echo not-running; exit 0; fi
osascript <<'APPLESCRIPT' 2>/dev/null | tr '\\n' '\\r'
set out to ""
tell application "Mail"
  try
    set out to "unread" & "@@F@@" & (unread count of inbox) & "@@R@@"
    set msgs to messages of inbox
    -- Mail hands the inbox back in no particular order: pick the 15 most
    -- recent by date received (one bulk property fetch, one pass).
    set ds to date received of messages of inbox
    set topIdx to {}
    set topDate to {}
    repeat with i from 1 to count of ds
      set d to item i of ds
      set k to count of topDate
      if k < 15 or d > item k of topDate then
        set pos to k + 1
        repeat while pos > 1 and d > item (pos - 1) of topDate
          set pos to pos - 1
        end repeat
        if pos > k then
          set end of topIdx to i
          set end of topDate to d
        else if pos = 1 then
          set topIdx to {i} & topIdx
          set topDate to {d} & topDate
        else
          set topIdx to (items 1 thru (pos - 1) of topIdx) & {i} & (items pos thru k of topIdx)
          set topDate to (items 1 thru (pos - 1) of topDate) & {d} & (items pos thru k of topDate)
        end if
        if (count of topDate) > 15 then
          set topIdx to items 1 thru 15 of topIdx
          set topDate to items 1 thru 15 of topDate
        end if
      end if
    end repeat
    repeat with i in topIdx
      set m to item (contents of i) of msgs
      set s to subject of m
      if s is missing value then set s to "(no subject)"
      set c to ""
      try
        set c to content of m
        if (length of c) > 1500 then set c to (text 1 thru 1500 of c) & "…"
      end try
      set d to ""
      try
        set d to (date received of m) as «class isot» as string
      end try
      set out to out & "msg" & "@@F@@" & (sender of m) & "@@F@@" & s & "@@F@@" & (read status of m) & "@@F@@" & d & "@@F@@" & (id of m) & "@@F@@" & c & "@@R@@"
    end repeat
  end try
end tell
return out
APPLESCRIPT
`;

export const refreshFrequency = 120000; // 2 min

export const glass = true;

// Needs clicks and scrolling: bruma listens to the mouse over this widget only.
export const interactive = true;

export const className = `
  top: 606px;
  left: 764px;
  width: 366px;
  height: 340px;
  box-sizing: border-box;
  padding: 14px 18px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --fg3: rgba(0,0,0,0.34);
  --blue: #007AFF;
  --sep: rgba(255,255,255,0.65);

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --blue: #0A84FF;
    --sep: rgba(255,255,255,0.22);
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .head { display: flex; align-items: center; gap: 6px; }
  .app { font-size: 13px; font-weight: 600; color: var(--blue); }
  .badge {
    margin-left: auto;
    min-width: 20px; height: 18px; padding: 0 6px; border-radius: 9px;
    background: var(--blue); color: #fff;
    font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
    font-variant-numeric: tabular-nums;
  }
  /* flex: 1 + gap: auto let the messages stretch into the extra height; the
     outer root has height: 100% so this has room to grow into. */
  /* min-height: 0 lets the flex item shrink below its content so it scrolls
     instead of pushing the box taller. */
  .list {
    margin-top: 6px; flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    overflow-y: auto; overscroll-behavior: contain;
    scrollbar-width: none;
  }
  .list::-webkit-scrollbar { display: none; }
  .msg {
    flex: none; padding: 7px 0; cursor: pointer;
    border-top: 1px solid var(--sep);
  }
  .msg:first-child { border-top: 0; padding-top: 2px; }
  .row { display: flex; gap: 8px; align-items: flex-start; }
  .dot { width: 7px; height: 7px; border-radius: 4px; margin-top: 4px; flex: none; }
  .txt { min-width: 0; flex: 1; }
  .from {
    font-size: 12px; line-height: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .when { font-size: 10px; color: var(--fg3); font-variant-numeric: tabular-nums; flex: none; margin-top: 2px; }
  .subject {
    font-size: 11px; font-weight: 500; line-height: 13px; color: var(--fg2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .open .subject { white-space: normal; color: var(--fg); font-weight: 600; }
  /* Unfold by animating the grid row from 0fr to 1fr: it slides to the text's
     natural height, which a plain height transition cannot do (height: auto). */
  .fold {
    display: grid; grid-template-rows: 0fr; opacity: 0;
    transition: grid-template-rows 0.3s ease, opacity 0.25s ease;
  }
  .open .fold { grid-template-rows: 1fr; opacity: 1; }
  .fold > div { overflow: hidden; min-height: 0; }
  .body {
    padding: 6px 0 0 15px; font-size: 11px; line-height: 15px; color: var(--fg2);
    white-space: pre-wrap; word-break: break-word;
  }
  .empty { margin: auto; font-size: 12px; font-weight: 500; color: var(--fg2); text-align: center; }
`;

// "Jane Doe <jane@example.com>" → "Jane Doe"; a bare address keeps its user part.
const person = (sender) => {
  const m = /^\s*"?([^"<]+?)"?\s*</.exec(sender || "");
  if (m) return m[1].trim();
  const addr = (sender || "").replace(/[<>]/g, "").trim();
  return addr.split("@")[0] || addr;
};

// "2026-10-05T19:32:10" → "19:32" for today, "5 Oct" otherwise.
const when = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

// Everything stateful lives in one component so the open message and the
// just-read marks survive the periodic re-render (the same component type
// keeps its state).
const Inbox = ({ msgs, unread }) => {
  const [open, setOpen] = useState(null);
  // Ids opened since the last refresh: shown as read right away, while Mail
  // is told in the background.
  const [seen, setSeen] = useState(() => new Set());

  const isRead = (m) => m.read || seen.has(m.id);
  // Once a refresh reports a message read, the server count already covers it.
  const shown = Math.max(0, unread - msgs.filter((m) => !m.read && seen.has(m.id)).length);

  const toggle = (m) => {
    setOpen(open === m.id ? null : m.id);
    if (isRead(m) || !/^\d+$/.test(m.id)) return;
    setSeen(new Set(seen).add(m.id));
    run(`osascript -e 'tell application "Mail" to set read status of (first message of inbox whose id is ${m.id}) to true' >/dev/null 2>&1`);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="head">
        <span className="app">Mail</span>
        {shown > 0 && <span className="badge">{shown}</span>}
      </div>
      <div className="list">
        {msgs.map((m) => {
          const isOpen = open === m.id;
          const read = isRead(m);
          return (
            <div className={"msg" + (isOpen ? " open" : "")} key={m.id} onClick={() => toggle(m)}>
              <div className="row">
                <span className="dot" style={{ background: read ? "transparent" : "var(--blue)" }} />
                <div className="txt">
                  <div className="from" style={{ fontWeight: read ? 600 : 700 }}>{m.from}</div>
                  <div className="subject">{m.subject}</div>
                </div>
                <span className="when">{when(m.date)}</span>
              </div>
              <div className="fold">
                <div><div className="body">{m.body || "(no content)"}</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const render = ({ output }) => {
  const notRunning = (output || "").trim() === "not-running";
  let unread = 0;
  const msgs = [];
  (output || "").split("@@R@@").forEach((rec) => {
    const f = rec.trim().split("@@F@@");
    if (f[0] === "unread") unread = parseInt(f[1], 10) || 0;
    else if (f[0] === "msg")
      msgs.push({
        id: f[5],
        from: person(f[1]),
        subject: f[2],
        read: f[3] === "true",
        date: f[4],
        body: (f[6] || "").replace(/\r/g, "\n").trim(),
      });
  });

  if (!msgs.length)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="head">
          <span className="app">Mail</span>
        </div>
        <div className="empty">{notRunning ? "Open Mail to see your inbox" : "Inbox zero"}</div>
      </div>
    );

  return <Inbox msgs={msgs} unread={unread} />;
};
