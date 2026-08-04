// CPU usage over time — 2x1, native widget look.
// Background: native Liquid Glass (glass = true); theme-aware colors.
// Samples with `top` every 2 s and draws the last ~2 minutes as
// area + line; the large number is the current value.
export const command = `top -l 2 -n 0 -s 1 | grep -E '^CPU usage' | tail -1`;

export const refreshFrequency = 2000; // 2 s per sample

export const glass = true;

export const className = `
  top: 234px;
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
  --grid: rgba(0,0,0,0.14);
  --blue: #007AFF;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
    --fg3: rgba(255,255,255,0.42);
    --grid: rgba(255,255,255,0.16);
    --blue: #0A84FF;
  }

  color: var(--fg);

  .header { display: flex; align-items: baseline; gap: 8px; }
  .title { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .range { font-size: 10px; font-weight: 500; color: var(--fg3); }
  .value {
    margin-left: auto;
    font-size: 24px; font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .value .pct { font-size: 14px; font-weight: 600; color: var(--fg2); }
  .chart { display: block; margin-top: 8px; overflow: visible; }
  .notice {
    height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--fg2); font-size: 13px; font-weight: 500;
  }
`;

// Sample history (persists across ticks: the module is evaluated once).
const history = [];
const MAX_SAMPLES = 60; // 60 × 2 s ≈ 2 min

// Internal geometry: 356 − 2·20 of padding = 316 of usable width.
const WIDTH = 316;
const HEIGHT = 88;
const LEFT_MARGIN = 26; // room for the 100/50/0 labels

const parseUsage = (raw) => {
  const m = /([\d.]+)%\s*idle/.exec(raw || "");
  if (!m) return null;
  return Math.min(100, Math.max(0, 100 - parseFloat(m[1])));
};

const buildPaths = (data) => {
  const x0 = LEFT_MARGIN;
  const plotWidth = WIDTH - x0;
  const step = data.length > 1 ? plotWidth / (MAX_SAMPLES - 1) : 0;
  // Anchor the series to the right edge: the newest sample is always rightmost.
  const xOf = (i) => x0 + plotWidth - (data.length - 1 - i) * step;
  const yOf = (v) => HEIGHT - (v / 100) * HEIGHT;
  const pts = data.map((v, i) => [xOf(i), yOf(v)]);
  const linePath = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const areaPath = linePath +
    " L" + pts[pts.length - 1][0].toFixed(1) + " " + HEIGHT +
    " L" + pts[0][0].toFixed(1) + " " + HEIGHT + " Z";
  return { linePath, areaPath, last: pts[pts.length - 1] };
};

export const render = ({ output }) => {
  const usage = parseUsage(output);
  if (usage !== null) {
    history.push(usage);
    if (history.length > MAX_SAMPLES) history.shift();
  }

  if (history.length < 2)
    return <div className="notice">Measuring CPU…</div>;

  const current = history[history.length - 1];
  const { linePath, areaPath, last } = buildPaths(history);
  const gridLines = [
    { v: 100, y: 0 },
    { v: 50, y: HEIGHT / 2 },
    { v: 0, y: HEIGHT },
  ];

  return (
    <div>
      <div className="header">
        <span className="title">Processor</span>
        <span className="range">last 2 min</span>
        <span className="value">
          {Math.round(current)}
          <span className="pct">%</span>
        </span>
      </div>
      <svg
        className="chart"
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id="cpuArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--blue)" }} stopOpacity="0.40" />
            <stop offset="100%" style={{ stopColor: "var(--blue)" }} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {gridLines.map(({ v, y }) => (
          <g key={v}>
            <line
              x1={LEFT_MARGIN} x2={WIDTH} y1={y} y2={y}
              style={{ stroke: "var(--grid)" }} strokeWidth="1"
              strokeDasharray={v === 0 ? "" : "3 4"}
            />
            <text
              x={LEFT_MARGIN - 6} y={y + 3} textAnchor="end"
              fontSize="9" fontWeight="500" style={{ fill: "var(--fg3)" }}
            >
              {v}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#cpuArea)" />
        <path
          d={linePath}
          fill="none" style={{ stroke: "var(--fg)" }} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
        />
        <circle
          cx={last[0]} cy={last[1]} r="3.5"
          style={{ fill: "var(--blue)", stroke: "var(--fg)" }} strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};
