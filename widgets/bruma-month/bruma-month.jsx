// Calendario de meses — número del mes en grande y 12 marcas tipo esfera.
// Fondo: Liquid Glass nativo (glass = true); colores siguen el tema del sistema.
export const command = "date +%m";

export const refreshFrequency = 3600000; // 1 h

export const glass = true;

export const className = `
  top: 48px;
  left: 206px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --tick: rgba(0,0,0,0.24);
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --tick: rgba(255,255,255,0.34);
    --red: #FF453A;
  }

  svg { display: block; }
`;

const R = 85;

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// Marca i (0 = enero, arriba). Las marcas se apoyan en una superelipse
// (círculo ligeramente hinchado hacia el cuadrado, esquinas suaves) y
// apuntan radialmente al centro. La del mes actual: roja, más larga y gruesa.
const monthTick = (i, current) => {
  const a = (i * 30) * Math.PI / 180;
  const on = i === current;
  const sin = Math.sin(a), cos = Math.cos(a);

  // superelipse |x/S|^n + |y/S|^n = 1 → radio según el ángulo
  const S = 66, n = 4;
  const r2 = S / Math.pow(Math.pow(Math.abs(sin), n) + Math.pow(Math.abs(cos), n), 1 / n);
  const r1 = r2 - (on ? 14 : 10);

  return (
    <line
      key={i}
      x1={R + r1 * sin} y1={R - r1 * cos}
      x2={R + r2 * sin} y2={R - r2 * cos}
      style={{ stroke: on ? "var(--red)" : "var(--tick)" }}
      strokeWidth={on ? 4.5 : 3}
      strokeLinecap="round"
    />
  );
};

export const render = ({ output }) => {
  const month = parseInt((output || "").trim(), 10) || 1;

  return (
    <svg width="170" height="170" viewBox="0 0 170 170">
      {[...Array(12)].map((_, i) => monthTick(i, month - 1))}
      <text x={R} y={58} textAnchor="middle" style={{ fill: "var(--red)" }}
        fontSize="12" fontWeight="700" letterSpacing="1.5">
        {MESES[month - 1]}
      </text>
      <text x={R} y={96} textAnchor="middle" dominantBaseline="central"
        style={{ fill: "var(--fg)" }} fontSize="58" fontWeight="700">
        {month}
      </text>
    </svg>
  );
};
