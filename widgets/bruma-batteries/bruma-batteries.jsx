// Batteries — 2x1, native macOS Batteries widget look.
// A ring for this Mac plus a row per connected device that reports a battery
// level (keyboard, trackpad, mouse, and anything else exposing BatteryPercent).
export const command = `
  pmset -g batt | awk '
    /InternalBattery/ {
      pct = $3; sub(/%;/, "", pct);
      state = $4; sub(/;/, "", state);
      printf "mac\\t%s\\t%s\\t%s\\n", pct, state, $5; found = 1
    }
    END { if (!found) printf "mac\\t\\tac\\t\\n" }'
  ioreg -r -k BatteryPercent -l 2>/dev/null | awk -F'"' '
    /^\\+-o/ { p = ""; b = "" }
    /"Product" =/ { p = $4 }
    /"BatteryPercent" =/ { b = $0; gsub(/[^0-9]/, "", b) }
    p != "" && b != "" { printf "dev\\t%s\\t%s\\n", p, b; p = ""; b = "" }'
`;

export const refreshFrequency = 60000; // 1 min

export const glass = true;

export const className = `
  top: 48px;
  left: 764px;
  width: 366px;
  height: 170px;
  box-sizing: border-box;
  padding: 16px 18px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.55);
  --fg3: rgba(0,0,0,0.38);
  --track: rgba(0,0,0,0.10);
  --green: #34C759;
  --yellow: #FF9500;
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
    --fg3: rgba(255,255,255,0.42);
    --track: rgba(255,255,255,0.14);
    --green: #30D158;
    --yellow: #FF9F0A;
    --red: #FF453A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .title { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .body { display: flex; align-items: center; gap: 16px; margin-top: 4px; flex: 1; }
  .mac { flex: none; text-align: center; }
  .mac .state {
    font-size: 11px; font-weight: 600; color: var(--fg2); margin-top: 2px;
    white-space: nowrap;
  }
  .devices { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 8px; }
  .row .name {
    font-size: 12px; font-weight: 600; flex: 1; min-width: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .row .pct {
    font-size: 12px; font-weight: 600; color: var(--fg2);
    font-variant-numeric: tabular-nums; flex: none;
  }
  .bar { height: 6px; border-radius: 3px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 3px; }
  .empty { font-size: 12px; font-weight: 500; color: var(--fg3); }
`;

const colorFor = (pct, charging) =>
  charging ? "var(--green)" : pct <= 10 ? "var(--red)" : pct <= 20 ? "var(--yellow)" : "var(--green)";

const macLabel = (state, time) => {
  if (state === "ac") return "Power adapter";
  if (state === "charged") return "Charged";
  if (state === "finishing") return "Finishing charge";
  if (state === "charging") return time && time !== "0:00" ? `${time} to full` : "Charging";
  if (state === "discharging") return time && time !== "0:00" ? `${time} left` : "On battery";
  return state || "";
};

// Strip the vendor noise Apple devices carry in their IORegistry name.
const shortName = (n) =>
  n.replace(/^Apple\s+/, "")
   .replace(/\s*\(.*\)$/, "")
   .replace(/ \/ /, " · ");

const Ring = ({ pct, color, known }) => {
  const cx = 44, cy = 44, r = 34, w = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" style={{ display: "block" }}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" style={{ stroke: "var(--track)" }} strokeWidth={w} />
        <circle cx={cx} cy={cy} r={r} fill="none" style={{ stroke: color }} strokeWidth={w}
          strokeLinecap="round" strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} />
      </g>
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="central"
        style={{ fill: "var(--fg)" }} fontSize="22" fontWeight="600">
        {known ? pct : "—"}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" dominantBaseline="central"
        style={{ fill: "var(--fg2)" }} fontSize="10" fontWeight="600">
        {known ? "%" : "AC"}
      </text>
    </svg>
  );
};

export const render = ({ output }) => {
  const lines = (output || "").trim().split("\n").filter(Boolean);
  let mac = { pct: NaN, state: "", time: "" };
  const devices = [];

  lines.forEach((l) => {
    const f = l.split("\t");
    if (f[0] === "mac") mac = { pct: parseInt(f[1], 10), state: f[2], time: f[3] };
    else if (f[0] === "dev") devices.push({ name: shortName(f[1]), pct: parseInt(f[2], 10) });
  });

  const known = !isNaN(mac.pct);
  const charging = ["charging", "charged", "finishing", "ac"].includes(mac.state);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="title">Batteries</div>
      <div className="body">
        <div className="mac">
          <Ring pct={known ? mac.pct : 100} color={colorFor(known ? mac.pct : 100, charging)} known={known} />
          <div className="state">{macLabel(mac.state, mac.time)}</div>
        </div>
        <div className="devices">
          {devices.length === 0 && <div className="empty">No other devices connected</div>}
          {devices.slice(0, 3).map((d, i) => (
            <div key={i}>
              <div className="row">
                <span className="name">{d.name}</span>
                <span className="pct">{d.pct}%</span>
              </div>
              <div className="bar" style={{ marginTop: "3px" }}>
                <i style={{ width: `${d.pct}%`, background: colorFor(d.pct, false) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
