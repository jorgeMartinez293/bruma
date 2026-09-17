// Clock (Digital) — 1x1, the digital face of the native macOS Clock widget.
// Big time, seconds ticking underneath, weekday and date below.
const TZ = ""; // e.g. "Asia/Tokyo"; empty = this Mac's time zone
const CITY = ""; // label under the time; empty = the local zone's city

export const command = TZ
  ? `TZ=${TZ} date '+%H %M %S %A %e %B'`
  : `date '+%H %M %S %A %e %B'; echo "$(readlink /etc/localtime | sed 's|.*zoneinfo/||')"`;

export const refreshFrequency = 1000;

export const glass = true;

export const className = `
  top: 606px;
  left: 950px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --accent: #FF9500;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --accent: #FF9F0A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;
  justify-content: center;

  .city {
    font-size: 11px; font-weight: 600; color: var(--fg2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .time {
    display: flex; align-items: baseline; gap: 3px;
    font-size: 42px; font-weight: 300; letter-spacing: -2px; line-height: 46px;
    font-variant-numeric: tabular-nums;
  }
  .time .sec {
    font-size: 15px; font-weight: 600; letter-spacing: 0; color: var(--accent);
  }
  .date { font-size: 12px; font-weight: 600; color: var(--fg2); margin-top: 2px; }
  .seconds { display: flex; gap: 2px; margin-top: 8px; }
  .seconds i {
    flex: 1; height: 3px; border-radius: 1.5px; background: var(--fg);
    opacity: 0.18;
  }
  .seconds i.on { opacity: 0.9; background: var(--accent); }
`;

export const render = ({ output }) => {
  const lines = (output || "").trim().split("\n");
  const f = (lines[0] || "").trim().split(/\s+/);
  if (f.length < 6) return null;

  const [h, m, s, weekday, day, month] = f;
  const zone = (lines[1] || "").trim();
  const city = CITY || (zone ? zone.split("/").pop().replace(/_/g, " ") : "");
  const secs = parseInt(s, 10) || 0;
  // Twelve blocks, one per five seconds of the current minute.
  const blocks = [...Array(12)].map((_, i) => i * 5 <= secs);

  return (
    <div>
      <div className="city">{city}</div>
      <div className="time">
        <span>{h}:{m}</span>
        <span className="sec">{s}</span>
      </div>
      <div className="date">{weekday.slice(0, 3)} {day} {month.slice(0, 3)}</div>
      <div className="seconds">
        {blocks.map((on, i) => <i key={i} className={on ? "on" : ""} />)}
      </div>
    </div>
  );
};
