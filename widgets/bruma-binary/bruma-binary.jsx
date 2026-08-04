// Binary clock (BCD) — one column of dots per digit of HH:MM:SS.
// Each dot is a bit (8/4/2/1 from bottom to top); they fill in as the
// seconds go by. No background: the dots sit straight on the wallpaper.
export const command = "date +'%H%M%S'";

export const refreshFrequency = 1000;

// Geometry — tweak DOT/STEP to scale the whole widget.
const DOT = 12;     // dot radius
const STEP_X = 38;  // spacing between columns (digits)
const STEP_Y = 40;  // spacing between rows (bits)

const W = DOT * 2 + STEP_X * 5;
const H = DOT * 2 + STEP_Y * 3;

const COL_X = [...Array(6)].map((_, i) => DOT + i * STEP_X);
const ROW_Y = [...Array(4)].map((_, b) => H - DOT - b * STEP_Y); // bit 1 at the bottom

export const className = `
  top: 48px;
  left: 20px;
  width: ${W}px;
  height: ${H}px;
  box-sizing: border-box;

  --on: rgba(255,255,255,0.95);
  --off: rgba(255,255,255,0.18);

  svg {
    display: block;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
  }
  circle { transition: fill .3s ease; }
`;

// 6 digits: tens/units of hours, minutes and seconds.
// bits = how many dots that digit needs (0-2, 0-9, 0-5, 0-9…).
const DIGITS = [2, 4, 3, 4, 3, 4];

// Dot for bit b (0 = value 1) of column col.
const dot = (col, b, on) => (
  <circle
    key={`${col}-${b}`}
    cx={COL_X[col]} cy={ROW_Y[b]} r={DOT}
    style={{ fill: on ? "var(--on)" : "var(--off)" }}
  />
);

export const render = ({ output }) => {
  const raw = (output || "").trim();
  const time = /^\d{6}$/.test(raw) ? raw : "100930";
  const digits = time.split("").map(Number);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {DIGITS.map((bits, col) =>
        [...Array(bits)].map((_, b) =>
          dot(col, b, (digits[col] >> b) & 1)
        )
      )}
    </svg>
  );
};
