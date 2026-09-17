// Calendar (Month) — 2x1, native macOS Calendar widget look.
// The whole month as a grid, today in a red disc, weekends dimmed.
// No data source needed beyond the date itself.
const WEEK_START = 1; // 0 = Sunday, 1 = Monday

export const command = "date '+%Y %m %d'";

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 420px;
  left: 392px;
  width: 366px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 18px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.50);
  --fg3: rgba(0,0,0,0.30);
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.55);
    --fg3: rgba(255,255,255,0.34);
    --red: #FF453A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);

  .head { display: flex; align-items: baseline; gap: 6px; }
  .month { font-size: 13px; font-weight: 700; color: var(--red); letter-spacing: 0.3px; }
  .year { font-size: 12px; font-weight: 600; color: var(--fg3); }
`;

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const COLS = 7, ROWS = 6;
const CELL_W = 47, CELL_H = 18;
const W = COLS * CELL_W, H = ROWS * CELL_H;

export const render = ({ output }) => {
  const [ys, ms, ds] = (output || "").trim().split(/\s+/);
  const now = new Date();
  const year = parseInt(ys, 10) || now.getFullYear();
  const month = (parseInt(ms, 10) || now.getMonth() + 1) - 1;
  const today = parseInt(ds, 10) || now.getDate();

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() - WEEK_START + 7) % 7;
  const headers = [...Array(7)].map((_, i) => DOW[(i + WEEK_START) % 7]);
  const isWeekend = (col) => {
    const dow = (col + WEEK_START) % 7;
    return dow === 0 || dow === 6;
  };

  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const day = i - lead + 1;
    if (day < 1 || day > daysInMonth) continue;
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = col * CELL_W + CELL_W / 2;
    const cy = row * CELL_H + CELL_H / 2;
    const isToday = day === today;
    cells.push(
      <g key={day}>
        {isToday && <circle cx={cx} cy={cy} r="9.5" style={{ fill: "var(--red)" }} />}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
          fontSize="11.5" fontWeight={isToday ? "700" : "500"}
          style={{ fill: isToday ? "#fff" : isWeekend(col) ? "var(--fg3)" : "var(--fg)" }}>
          {day}
        </text>
      </g>
    );
  }

  return (
    <div>
      <div className="head">
        <span className="month">{MONTHS[month].toUpperCase()}</span>
        <span className="year">{year}</span>
      </div>
      <svg width={W} height={H + 16} viewBox={`0 0 ${W} ${H + 16}`}
        style={{ display: "block", marginTop: "2px" }}>
        {headers.map((d, i) => (
          <text key={i} x={i * CELL_W + CELL_W / 2} y={7} textAnchor="middle"
            dominantBaseline="central" fontSize="9.5" fontWeight="600"
            style={{ fill: "var(--fg2)" }}>
            {d}
          </text>
        ))}
        <g transform="translate(0 16)">{cells}</g>
      </svg>
    </div>
  );
};
