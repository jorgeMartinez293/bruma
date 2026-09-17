// Battery — 1x1, native macOS Batteries widget look (this Mac only).
// Charge as a ring, plus the state line pmset reports (charging, time left…).
export const command = `
  pmset -g batt | awk '
    /InternalBattery/ {
      pct = $3; sub(/%;/, "", pct);
      state = $4; sub(/;/, "", state);
      printf "%s\\t%s\\t%s\\n", pct, state, $5; found = 1
    }
    END { if (!found) print "\\tac\\t" }'
`;

export const refreshFrequency = 30000; // 30 s

export const glass = true;

export const className = `
  top: 48px;
  left: 578px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.55);
  --track: rgba(0,0,0,0.10);
  --green: #34C759;
  --yellow: #FF9500;
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
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
  .ring { margin: 2px auto 0; }
  .state {
    text-align: center;
    font-size: 11px; font-weight: 600; color: var(--fg2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
`;

const CX = 69, CY = 52, R = 40, W = 9;

export const ring = (pct, color) => {
  const c = 2 * Math.PI * R;
  return (
    <g transform={`rotate(-90 ${CX} ${CY})`}>
      <circle cx={CX} cy={CY} r={R} fill="none"
        style={{ stroke: "var(--track)" }} strokeWidth={W} />
      <circle cx={CX} cy={CY} r={R} fill="none"
        style={{ stroke: color }} strokeWidth={W} strokeLinecap="round"
        strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} />
    </g>
  );
};

export const colorFor = (pct, charging) =>
  charging ? "var(--green)" : pct <= 10 ? "var(--red)" : pct <= 20 ? "var(--yellow)" : "var(--green)";

const label = (state, time) => {
  if (state === "ac") return "Power adapter";
  if (state === "charged") return "Charged";
  if (state === "finishing") return "Finishing charge";
  if (state === "charging") return time && time !== "0:00" ? `${time} to full` : "Charging";
  if (state === "discharging") return time && time !== "0:00" ? `${time} left` : "On battery";
  return state || "";
};

export const render = ({ output }) => {
  const [p, state, time] = (output || "").trim().split("\t");
  const pct = parseInt(p, 10);
  const known = !isNaN(pct);
  const charging = state === "charging" || state === "charged" || state === "finishing" || state === "ac";
  const value = known ? pct : 100;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="title">Battery</div>
      <svg className="ring" width="138" height="104" viewBox="0 0 138 104">
        {ring(value, colorFor(value, charging))}
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central"
          style={{ fill: "var(--fg)" }} fontSize="28" fontWeight="600">
          {known ? value : "—"}
        </text>
        <text x={CX} y={CY + 20} textAnchor="middle" dominantBaseline="central"
          style={{ fill: "var(--fg2)" }} fontSize="11" fontWeight="600">
          {known ? "%" : "AC"}
        </text>
        {charging && state !== "ac" && (
          <path d="M69 74l-5 8h4l-1.5 7 6-9h-4l2.5-6z" style={{ fill: "var(--green)" }} />
        )}
      </svg>
      <div className="state">{label(state, time)}</div>
    </div>
  );
};
