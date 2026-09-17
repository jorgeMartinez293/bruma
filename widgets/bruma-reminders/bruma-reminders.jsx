// Reminders — 2x1, native macOS Reminders widget look.
// Open reminders, soonest due first, with their list name.
//
// Reads reminders through EventKit (bruma's native `reminders`), so
// Reminders.app is never launched. macOS asks once for access to Reminders
// (System Settings → Privacy & Security → Reminders); until it is granted the
// widget says so.
import { reminders } from "bruma";

export const command = () => reminders();

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 606px;
  left: 392px;
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
  --ring: rgba(0,0,0,0.28);
  --blue: #007AFF;
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --ring: rgba(255,255,255,0.34);
    --blue: #0A84FF;
    --red: #FF453A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .head { display: flex; align-items: baseline; gap: 6px; }
  .title { font-size: 13px; font-weight: 600; color: var(--blue); }
  .count { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--fg3); }
  .list {
    margin-top: 5px; display: flex; flex-direction: column; gap: 5px;
    overflow: hidden;
  }
  .item { display: flex; gap: 8px; align-items: flex-start; }
  .dot { margin-top: 1px; flex: none; }
  .txt { min-width: 0; flex: 1; }
  .name {
    font-size: 12px; font-weight: 600; line-height: 13px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta {
    font-size: 11px; font-weight: 500; line-height: 12px; color: var(--fg2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta .late { color: var(--red); font-weight: 600; }
  .empty { margin: auto; font-size: 12px; font-weight: 500; color: var(--fg2); }
`;

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const dueLabel = (due) => {
  if (!due) return null;
  const now = new Date();
  const days = Math.round((due - now) / 86400000);
  const sameDay = due.toDateString() === now.toDateString();
  if (due < now) return { text: sameDay ? `Today ${hhmm(due)}` : "Overdue", late: true };
  if (sameDay) return { text: `Today ${hhmm(due)}`, late: false };
  if (days <= 1) return { text: `Tomorrow ${hhmm(due)}`, late: false };
  if (days < 7) return { text: `${DOW[due.getDay()]} ${hhmm(due)}`, late: false };
  return { text: `${due.getDate()}/${due.getMonth() + 1}`, late: false };
};

export const render = ({ output }) => {
  const status = output && output.status;
  const items = ((output && output.items) || [])
    .map((r) => ({
      name: r.title,
      due: r.due != null ? new Date(r.due) : null,
      list: r.list,
      prio: r.priority || 0
    }))
    .sort((a, b) => {
      if (a.due && b.due) return a.due - b.due;
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });

  const head = (
    <div className="head">
      <span className="title">Reminders</span>
      <span className="count">{items.length ? `${items.length} open` : ""}</span>
    </div>
  );

  if (!items.length)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {head}
        <div className="empty">{status === "denied" ? "Allow access to Reminders in System Settings"
          : status === "authorized" ? "Nothing left to do" : "Reminders unavailable"}</div>
      </div>
    );

  return (
    <div>
      {head}
      <div className="list">
        {items.slice(0, 4).map((r, i) => {
          const due = dueLabel(r.due);
          return (
            <div className="item" key={i}>
              <svg className="dot" width="13" height="13" viewBox="0 0 13 13">
                <circle cx="6.5" cy="6.5" r="5.5" fill="none"
                  style={{ stroke: r.prio > 0 && r.prio <= 5 ? "var(--red)" : "var(--ring)" }}
                  strokeWidth="1.5" />
              </svg>
              <div className="txt">
                <div className="name">{r.name}</div>
                <div className="meta">
                  {due && <span className={due.late ? "late" : ""}>{due.text}</span>}
                  {due && r.list ? " · " : ""}
                  {r.list}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
