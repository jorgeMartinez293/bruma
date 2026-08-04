// Claude Code usage — 2x1, same box as bruma-cpu.
// /usage-style grid: one square per day, one column per week.
// Source: ~/.claude/stats-cache.json (kept up to date by Claude Code itself).
export const command = `cat "$HOME/.claude/stats-cache.json" 2>/dev/null || echo '{}'`;

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 424px;
  left: 20px;
  width: 356px;
  height: 170px;
  box-sizing: border-box;
  padding: 18px 20px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.55);
  --fg3: rgba(0,0,0,0.38);
  --track: rgba(0,0,0,0.10);
  --ink: #000;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
    --fg3: rgba(255,255,255,0.42);
    --track: rgba(255,255,255,0.10);
    --ink: #fff;
  }

  color: var(--fg);
  overflow: hidden;

  /* Title and meta stack on the left so the header never has to fit
     three long items on one 316px line. */
  .header { display: flex; align-items: center; gap: 10px; height: 27px; }
  .titles { min-width: 0; }
  .title {
    font-size: 13px; font-weight: 600; line-height: 15px; color: var(--fg2);
    white-space: nowrap;
  }
  .range {
    font-size: 10px; font-weight: 500; line-height: 12px; color: var(--fg3);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .value {
    margin-left: auto; flex: none;
    font-size: 22px; font-weight: 700; line-height: 22px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .value .u { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .grid { display: block; margin-top: 10px; max-width: 100%; }
  .notice {
    height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--fg2); font-size: 13px; font-weight: 500;
  }
`;

// Geometry: 356 − 2·20 of padding = 316 of usable width,
// 170 − 2·18 = 134 of usable height (27 header + 10 gap + 95 grid = 132).
const SIDE = 11;  // square side
const GAP = 3;    // spacing between squares
const STEP = SIDE + GAP;
const LEFT_MARGIN = 22; // room for the M/W/F initials
const WEEKS = Math.floor((316 - LEFT_MARGIN + GAP) / STEP);
const WIDTH = LEFT_MARGIN + WEEKS * STEP - GAP;
const HEIGHT = 7 * STEP - GAP;

// Ink intensity scale: 0 = empty, then 4 levels.
const LEVELS = [0.22, 0.42, 0.66, 0.95];

const dayKey = (d) =>
  d.getFullYear() +
  "-" + String(d.getMonth() + 1).padStart(2, "0") +
  "-" + String(d.getDate()).padStart(2, "0");

// Monday of the week `d` belongs to.
const mondayOf = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};

const parse = (raw) => {
  try {
    const j = JSON.parse(raw || "{}");
    const days = new Map();
    for (const d of j.dailyActivity || []) days.set(d.date, d.messageCount || 0);
    return days;
  } catch (e) {
    return null;
  }
};

// Thresholds from the quartiles of the active days: keeps a single spike
// from flattening the rest of the grid.
const buildThresholds = (values) => {
  const v = values.filter((n) => n > 0).sort((a, b) => a - b);
  if (!v.length) return [1, 2, 3, 4];
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [q(0.25), q(0.5), q(0.75), Infinity];
};

const levelOf = (n, thresholds) => {
  if (!n) return -1;
  for (let i = 0; i < thresholds.length; i++) if (n <= thresholds[i]) return i;
  return thresholds.length - 1;
};

export const render = ({ output }) => {
  const days = parse(output);
  if (!days) return <div className="notice">No Claude Code data</div>;

  const today = new Date();
  const firstMonday = mondayOf(today);
  firstMonday.setDate(firstMonday.getDate() - (WEEKS - 1) * 7);

  const cells = [];
  const values = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(firstMonday);
      date.setDate(date.getDate() + w * 7 + d);
      const future = date > today;
      const n = future ? 0 : days.get(dayKey(date)) || 0;
      if (!future) values.push(n);
      cells.push({ w, d, n, future, id: dayKey(date) });
    }
  }

  const thresholds = buildThresholds(values);
  const total = values.reduce((a, b) => a + b, 0);
  const activeDays = values.filter((n) => n > 0).length;

  // Current streak: consecutive days with activity up to today.
  // A today still at zero does not break yesterday's streak.
  let streak = 0;
  let isToday = true;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.future) continue;
    if (c.n > 0) streak++;
    else if (!isToday) break;
    isToday = false;
  }

  const dayInitials = ["M", "", "W", "", "F", "", ""];

  return (
    <div>
      <div className="header">
        <div className="titles">
          <div className="title">Claude Code</div>
          <div className="range">
            {activeDays} active days · {streak} day streak
          </div>
        </div>
        <span className="value">
          {total >= 1000 ? (total / 1000).toFixed(1) : total}
          <span className="u">{total >= 1000 ? "k msg" : " msg"}</span>
        </span>
      </div>
      <svg
        className="grid"
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {dayInitials.map((t, d) =>
          t ? (
            <text
              key={d}
              x={LEFT_MARGIN - 6}
              y={d * STEP + SIDE - 2}
              textAnchor="end"
              fontSize="8"
              fontWeight="500"
              style={{ fill: "var(--fg3)" }}
            >
              {t}
            </text>
          ) : null
        )}
        {cells.map(({ w, d, n, future, id }) => {
          const level = levelOf(n, thresholds);
          return (
            <rect
              key={id}
              x={LEFT_MARGIN + w * STEP}
              y={d * STEP}
              width={SIDE}
              height={SIDE}
              rx="2.5"
              fill={level < 0 ? "var(--track)" : "var(--ink)"}
              fillOpacity={level < 0 ? (future ? 0.35 : 1) : LEVELS[level]}
            />
          );
        })}
      </svg>
    </div>
  );
};
