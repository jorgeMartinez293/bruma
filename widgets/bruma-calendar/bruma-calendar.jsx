// Calendar (Up Next) — 2x1, native macOS Calendar widget look.
// The next events from your calendars, over the next two days.
//
// Reads the calendars through EventKit (bruma's native `calendarEvents`), so
// Calendar.app is never launched. macOS asks once for access to Calendars
// (System Settings → Privacy & Security → Calendars); until it is granted the
// widget says so.
import { calendarEvents } from "bruma";

export const command = () => calendarEvents({ days: 2 });

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 234px;
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
  --red: #FF3B30;
  --line: rgba(0,0,0,0.10);

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --red: #FF453A;
    --line: rgba(255,255,255,0.14);
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .head { display: flex; align-items: baseline; gap: 6px; }
  .dow { font-size: 12px; font-weight: 700; color: var(--red); letter-spacing: 0.4px; }
  .day { font-size: 13px; font-weight: 700; }
  .count { margin-left: auto; font-size: 11px; font-weight: 600; color: var(--fg3); }
  .list {
    margin-top: 6px; display: flex; flex-direction: column; gap: 6px;
    overflow: hidden;
  }
  .ev { display: flex; gap: 8px; align-items: flex-start; }
  .bar { width: 3px; border-radius: 2px; background: var(--red); align-self: stretch; flex: none; }
  .txt { min-width: 0; flex: 1; }
  .title {
    font-size: 12px; font-weight: 600; line-height: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .when { font-size: 11px; font-weight: 500; color: var(--fg2); line-height: 13px; }
  .empty { margin: auto; font-size: 12px; font-weight: 500; color: var(--fg2); text-align: center; }
`;

const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const whenLabel = (start, allDay) => {
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000).toDateString() === start.toDateString();
  const prefix = sameDay ? "" : tomorrow ? "Tomorrow " : `${DOW[start.getDay()].slice(0, 3)} `;
  if (allDay) return (prefix || "Today ") + "all day";
  const mins = Math.round((start - now) / 60000);
  if (sameDay && mins >= 0 && mins < 60) return `in ${mins} min · ${hhmm(start)}`;
  return prefix + hhmm(start);
};

export const render = ({ output }) => {
  const status = output && output.status;
  const now = new Date();
  const events = ((output && output.events) || [])
    .map((e) => ({ title: e.title, start: new Date(e.start), allDay: e.allDay }))
    .sort((a, b) => a.start - b.start);

  const head = (
    <div className="head">
      <span className="dow">{DOW[now.getDay()]}</span>
      <span className="day">{now.getDate()}</span>
      <span className="count">
        {events.length ? `${events.length} upcoming` : ""}
      </span>
    </div>
  );

  if (!events.length)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {head}
        <div className="empty">{status === "denied" ? "Allow access to Calendars in System Settings"
          : status === "authorized" ? "No events in the next two days" : "Calendars unavailable"}</div>
      </div>
    );

  return (
    <div>
      {head}
      <div className="list">
        {events.slice(0, 4).map((e, i) => (
          <div className="ev" key={i}>
            <div className="bar" />
            <div className="txt">
              <div className="title">{e.title}</div>
              <div className="when">{whenLabel(e.start, e.allDay)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
