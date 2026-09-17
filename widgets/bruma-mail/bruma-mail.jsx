// Mail — 2x1, native macOS Mail widget look.
// Unread count plus the newest messages in the inbox.
//
// Reads Mail.app over AppleScript: macOS asks once for permission to control
// Mail (System Settings → Privacy & Security → Automation).
//
// The command never launches Mail: if the app is not running it prints
// "not-running" and the widget asks the user to open it. (A `tell application`
// block would otherwise start the app — e.g. whenever the gallery renders
// its previews.)
export const command = `
if ! pgrep -x Mail > /dev/null 2>&1; then echo not-running; exit 0; fi
osascript <<'APPLESCRIPT' 2>/dev/null
set out to ""
tell application "Mail"
  try
    set out to "unread" & tab & (unread count of inbox) & linefeed
    set msgs to messages of inbox
    set n to count of msgs
    if n > 4 then set n to 4
    repeat with i from 1 to n
      set m to item i of msgs
      set s to subject of m
      if s is missing value then set s to "(no subject)"
      set out to out & "msg" & tab & (sender of m) & tab & s & tab & (read status of m) & linefeed
    end repeat
  end try
end tell
return out
APPLESCRIPT
`;

export const refreshFrequency = 120000; // 2 min

export const glass = true;

export const className = `
  top: 606px;
  left: 764px;
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
  --blue: #007AFF;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --blue: #0A84FF;
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
  .list {
    margin-top: 6px; display: flex; flex-direction: column; gap: 7px;
    overflow: hidden;
  }
  .msg { display: flex; gap: 8px; align-items: flex-start; }
  .dot { width: 7px; height: 7px; border-radius: 4px; margin-top: 4px; flex: none; }
  .txt { min-width: 0; flex: 1; }
  .from {
    font-size: 12px; line-height: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .subject {
    font-size: 11px; font-weight: 500; line-height: 13px; color: var(--fg2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
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

export const render = ({ output }) => {
  const notRunning = (output || "").trim() === "not-running";
  const lines = (output || "").trim().split("\n").filter(Boolean);
  let unread = 0;
  const msgs = [];
  lines.forEach((l) => {
    const f = l.split("\t");
    if (f[0] === "unread") unread = parseInt(f[1], 10) || 0;
    else if (f[0] === "msg")
      msgs.push({ from: person(f[1]), subject: f[2], read: f[3] === "true" });
  });

  const head = (
    <div className="head">
      <span className="app">Mail</span>
      {unread > 0 && <span className="badge">{unread}</span>}
    </div>
  );

  if (!msgs.length)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {head}
        <div className="empty">{notRunning ? "Open Mail to see your inbox" : "Inbox zero"}</div>
      </div>
    );

  return (
    <div>
      {head}
      <div className="list">
        {msgs.map((m, i) => (
          <div className="msg" key={i}>
            <span className="dot" style={{ background: m.read ? "transparent" : "var(--blue)" }} />
            <div className="txt">
              <div className="from" style={{ fontWeight: m.read ? 600 : 700 }}>{m.from}</div>
              <div className="subject">{m.subject}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
