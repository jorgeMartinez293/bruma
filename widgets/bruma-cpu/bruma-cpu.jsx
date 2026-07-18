// Uso de CPU a lo largo del tiempo — 2x1, estética de widget nativo.
// Fondo: Liquid Glass nativo (glass = true); colores siguen el tema.
// Muestrea con `top` cada 2 s y dibuja los últimos ~2 minutos como
// área + línea; el número grande es el valor actual.
export const command = `top -l 2 -n 0 -s 1 | grep -E '^CPU usage' | tail -1`;

export const refreshFrequency = 2000; // 2 s por muestra

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

  .cabecera { display: flex; align-items: baseline; gap: 8px; }
  .titulo { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .rango { font-size: 10px; font-weight: 500; color: var(--fg3); }
  .valor {
    margin-left: auto;
    font-size: 24px; font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .valor .pct { font-size: 14px; font-weight: 600; color: var(--fg2); }
  .grafica { display: block; margin-top: 8px; overflow: visible; }
  .aviso {
    height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--fg2); font-size: 13px; font-weight: 500;
  }
`;

// Historial de muestras (persiste entre ticks: el módulo se evalúa una vez).
const historial = [];
const MAX_MUESTRAS = 60; // 60 × 2 s ≈ 2 min

// Geometría interna: 356 − 2·20 de padding = 316 de ancho útil.
const ANCHO = 316;
const ALTO = 88;
const MARGEN_IZQ = 26; // hueco para las etiquetas 100/50/0

const parseaUso = (raw) => {
  const m = /([\d.]+)%\s*idle/.exec(raw || "");
  if (!m) return null;
  return Math.min(100, Math.max(0, 100 - parseFloat(m[1])));
};

const construyeCaminos = (datos) => {
  const x0 = MARGEN_IZQ;
  const anchoPlot = ANCHO - x0;
  const paso = datos.length > 1 ? anchoPlot / (MAX_MUESTRAS - 1) : 0;
  // Ancla la serie al borde derecho: lo más reciente siempre a la derecha.
  const xDe = (i) => x0 + anchoPlot - (datos.length - 1 - i) * paso;
  const yDe = (v) => ALTO - (v / 100) * ALTO;
  const pts = datos.map((v, i) => [xDe(i), yDe(v)]);
  const linea = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
  const area = linea +
    " L" + pts[pts.length - 1][0].toFixed(1) + " " + ALTO +
    " L" + pts[0][0].toFixed(1) + " " + ALTO + " Z";
  return { linea, area, ultimo: pts[pts.length - 1] };
};

export const render = ({ output }) => {
  const uso = parseaUso(output);
  if (uso !== null) {
    historial.push(uso);
    if (historial.length > MAX_MUESTRAS) historial.shift();
  }

  if (historial.length < 2)
    return <div className="aviso">Midiendo CPU…</div>;

  const actual = historial[historial.length - 1];
  const { linea, area, ultimo } = construyeCaminos(historial);
  const rejilla = [
    { v: 100, y: 0 },
    { v: 50, y: ALTO / 2 },
    { v: 0, y: ALTO },
  ];

  return (
    <div>
      <div className="cabecera">
        <span className="titulo">Procesador</span>
        <span className="rango">últimos 2 min</span>
        <span className="valor">
          {Math.round(actual)}
          <span className="pct">%</span>
        </span>
      </div>
      <svg
        className="grafica"
        width={ANCHO}
        height={ALTO}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
      >
        <defs>
          <linearGradient id="cpuArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--blue)" }} stopOpacity="0.40" />
            <stop offset="100%" style={{ stopColor: "var(--blue)" }} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {rejilla.map(({ v, y }) => (
          <g key={v}>
            <line
              x1={MARGEN_IZQ} x2={ANCHO} y1={y} y2={y}
              style={{ stroke: "var(--grid)" }} strokeWidth="1"
              strokeDasharray={v === 0 ? "" : "3 4"}
            />
            <text
              x={MARGEN_IZQ - 6} y={y + 3} textAnchor="end"
              fontSize="9" fontWeight="500" style={{ fill: "var(--fg3)" }}
            >
              {v}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#cpuArea)" />
        <path
          d={linea}
          fill="none" style={{ stroke: "var(--fg)" }} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"
        />
        <circle
          cx={ultimo[0]} cy={ultimo[1]} r="3.5"
          style={{ fill: "var(--blue)", stroke: "var(--fg)" }} strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};
