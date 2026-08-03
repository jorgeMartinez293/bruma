// Reloj binario (BCD) — una columna de puntos por dígito de HH:MM:SS.
// Cada punto es un bit (8/4/2/1 de abajo a arriba); se van rellenando conforme
// pasan los segundos. Sin fondo: los puntos van sueltos sobre el wallpaper.
export const command = "date +'%H%M%S'";

export const refreshFrequency = 1000;

// Geometría — toca DOT/STEP para escalar el widget entero.
const DOT = 12;     // radio del punto
const STEP_X = 38;  // separación entre columnas (dígitos)
const STEP_Y = 40;  // separación entre filas (bits)

const W = DOT * 2 + STEP_X * 5;
const H = DOT * 2 + STEP_Y * 3;

const COL_X = [...Array(6)].map((_, i) => DOT + i * STEP_X);
const ROW_Y = [...Array(4)].map((_, b) => H - DOT - b * STEP_Y); // bit 1 abajo

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

// 6 dígitos: decenas/unidades de horas, minutos y segundos.
// bits = cuántos puntos necesita ese dígito (0-2, 0-9, 0-5, 0-9…).
const DIGITS = [2, 4, 3, 4, 3, 4];

// Punto del bit b (0 = valor 1) de la columna col.
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
