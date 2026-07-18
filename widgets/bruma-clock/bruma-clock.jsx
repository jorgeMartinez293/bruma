// Reloj analógico — estética de widget nativo macOS.
// El fondo es Liquid Glass real (lo pinta bruma con NSGlassEffectView detrás
// del webview); aquí solo va el contenido, con colores que siguen el tema.
export const command = "date +'%H %M %S'";

export const refreshFrequency = 1000;

export const glass = true;

export const className = `
  top: 48px;
  left: 20px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --tick: rgba(0,0,0,0.30);
  --accent: #FF9500;
  --pin: rgba(255,255,255,0.95);

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --tick: rgba(255,255,255,0.40);
    --accent: #FF9F0A;
    --pin: #1c1c1e;
  }

  svg { display: block; }
`;

const R = 85; // centro del viewBox 170x170

const tick = (i) => {
  const a = (i * 30) * Math.PI / 180;
  const r1 = 66, r2 = 72;
  return (
    <line
      key={i}
      x1={R + r1 * Math.sin(a)} y1={R - r1 * Math.cos(a)}
      x2={R + r2 * Math.sin(a)} y2={R - r2 * Math.cos(a)}
      style={{ stroke: "var(--tick)" }} strokeWidth="2.5" strokeLinecap="round"
    />
  );
};

const numeral = (n) => {
  const a = (n * 30) * Math.PI / 180;
  const r = 54;
  return (
    <text
      key={n}
      x={R + r * Math.sin(a)} y={R - r * Math.cos(a)}
      textAnchor="middle" dominantBaseline="central"
      style={{ fill: "var(--fg)" }} fontSize="14" fontWeight="600"
    >{n}</text>
  );
};

const hand = (angle, length, width, color, tail = 0) => {
  const a = angle * Math.PI / 180;
  return (
    <line
      x1={R - tail * Math.sin(a)} y1={R + tail * Math.cos(a)}
      x2={R + length * Math.sin(a)} y2={R - length * Math.cos(a)}
      style={{ stroke: color }} strokeWidth={width} strokeLinecap="round"
    />
  );
};

export const render = ({ output }) => {
  const parts = (output || "").trim().split(/\s+/).map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [10, 9, 30];
  const hourA = (h % 12) * 30 + m * 0.5;
  const minA = m * 6 + s * 0.1;
  const secA = s * 6;

  return (
    <svg width="170" height="170" viewBox="0 0 170 170">
      {[...Array(12)].map((_, i) => tick(i))}
      {[...Array(12)].map((_, i) => numeral(i === 0 ? 12 : i))}
      {hand(hourA, 34, 5.5, "var(--fg)")}
      {hand(minA, 52, 4, "var(--fg)")}
      {hand(secA, 60, 1.6, "var(--accent)", 12)}
      <circle cx={R} cy={R} r="4.5" style={{ fill: "var(--accent)" }} />
      <circle cx={R} cy={R} r="1.8" style={{ fill: "var(--pin)" }} />
    </svg>
  );
};
