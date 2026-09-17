// World Clock — 2x1, native macOS Clock widget look (four cities).
// Each dial is an analog clock; its face goes dark while it is night there,
// the way the system widget does. Edit ZONES: [tz, label].
const ZONES = [
  ["Europe/Madrid", "Madrid"],
  ["Europe/London", "London"],
  ["America/New_York", "New York"],
  ["Asia/Tokyo", "Tokyo"],
];

export const command = ZONES.map(([tz]) => `TZ=${tz} date +'%H %M %S'`).join("; ");

export const refreshFrequency = 1000;

export const glass = true;

export const className = `
  top: 420px;
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
  --tick: rgba(0,0,0,0.28);
  --face: rgba(255,255,255,0.35);
  --night: rgba(0,0,0,0.55);
  --night-fg: rgba(255,255,255,0.92);
  --night-tick: rgba(255,255,255,0.35);
  --accent: #FF9500;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
    --tick: rgba(255,255,255,0.38);
    --face: rgba(255,255,255,0.10);
    --night: rgba(0,0,0,0.45);
    --night-fg: rgba(255,255,255,0.92);
    --night-tick: rgba(255,255,255,0.35);
    --accent: #FF9F0A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .title { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .row { display: flex; justify-content: space-between; margin-top: 6px; }
  .city { width: 74px; text-align: center; }
  .name {
    font-size: 11px; font-weight: 600; margin-top: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .time {
    font-size: 11px; font-weight: 600; color: var(--fg2);
    font-variant-numeric: tabular-nums;
  }
`;

const R = 33;

const Dial = ({ h, m, s }) => {
  const night = h < 6 || h >= 19;
  const fg = night ? "var(--night-fg)" : "var(--fg)";
  const tick = night ? "var(--night-tick)" : "var(--tick)";
  const hourA = (h % 12) * 30 + m * 0.5;
  const minA = m * 6 + s * 0.1;
  const secA = s * 6;

  const hand = (angle, len, w, color, tail = 0) => {
    const a = angle * Math.PI / 180;
    return (
      <line
        x1={R - tail * Math.sin(a)} y1={R + tail * Math.cos(a)}
        x2={R + len * Math.sin(a)} y2={R - len * Math.cos(a)}
        style={{ stroke: color }} strokeWidth={w} strokeLinecap="round"
      />
    );
  };

  return (
    <svg width="66" height="66" viewBox="0 0 66 66" style={{ display: "block", margin: "0 auto" }}>
      <circle cx={R} cy={R} r={R - 1}
        style={{ fill: night ? "var(--night)" : "var(--face)" }} />
      {[...Array(12)].map((_, i) => {
        const a = (i * 30) * Math.PI / 180;
        const big = i % 3 === 0;
        const r1 = big ? 22 : 25, r2 = 28;
        return (
          <line key={i}
            x1={R + r1 * Math.sin(a)} y1={R - r1 * Math.cos(a)}
            x2={R + r2 * Math.sin(a)} y2={R - r2 * Math.cos(a)}
            style={{ stroke: tick }} strokeWidth={big ? 2 : 1.2} strokeLinecap="round" />
        );
      })}
      {hand(hourA, 14, 3, fg)}
      {hand(minA, 21, 2.2, fg)}
      {hand(secA, 24, 1, "var(--accent)", 5)}
      <circle cx={R} cy={R} r="2" style={{ fill: "var(--accent)" }} />
    </svg>
  );
};

export const render = ({ output }) => {
  const lines = (output || "").trim().split("\n");

  return (
    <div>
      <div className="title">World Clock</div>
      <div className="row">
        {ZONES.map(([tz, label], i) => {
          const p = (lines[i] || "").trim().split(/\s+/).map(Number);
          const [h, m, s] = p.length === 3 ? p : [0, 0, 0];
          return (
            <div className="city" key={tz}>
              <Dial h={h} m={m} s={s} />
              <div className="name">{label}</div>
              <div className="time">
                {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
