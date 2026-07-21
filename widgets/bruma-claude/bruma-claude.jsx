// Uso de Claude Code — 2x1, misma caja que bruma-cpu.
// Rejilla tipo /usage: un cuadrado por día, una columna por semana.
// Fuente: ~/.claude/stats-cache.json (lo mantiene el propio Claude Code).
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

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
    --fg3: rgba(255,255,255,0.42);
    --track: rgba(255,255,255,0.10);
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
  .valor .u { font-size: 14px; font-weight: 600; color: var(--fg2); }
  .rejilla { display: block; margin-top: 10px; }
  .aviso {
    height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--fg2); font-size: 13px; font-weight: 500;
  }
`;

// Geometría: 356 − 2·20 de padding = 316 de ancho útil.
const ANCHO = 316;
const LADO = 11;   // lado del cuadrado
const HUECO = 3;   // separación entre cuadrados
const PASO = LADO + HUECO;
const MARGEN_IZQ = 16; // hueco para las iniciales L/X/V
const SEMANAS = Math.floor((ANCHO - MARGEN_IZQ + HUECO) / PASO);
const ALTO = 7 * PASO - HUECO;

// Escala de intensidad en blanco: 0 = vacío, luego 4 niveles.
const NIVELES = [0.22, 0.42, 0.66, 0.95];

const clave = (d) =>
  d.getFullYear() +
  "-" + String(d.getMonth() + 1).padStart(2, "0") +
  "-" + String(d.getDate()).padStart(2, "0");

// Lunes de la semana a la que pertenece `d`.
const lunesDe = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};

const parsea = (raw) => {
  try {
    const j = JSON.parse(raw || "{}");
    const dias = new Map();
    for (const d of j.dailyActivity || []) dias.set(d.date, d.messageCount || 0);
    return dias;
  } catch (e) {
    return null;
  }
};

// Umbrales por cuartiles de los días con actividad: evita que un pico
// aplaste al resto de la rejilla.
const construyeUmbrales = (valores) => {
  const v = valores.filter((n) => n > 0).sort((a, b) => a - b);
  if (!v.length) return [1, 2, 3, 4];
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [q(0.25), q(0.5), q(0.75), Infinity];
};

const nivelDe = (n, umbrales) => {
  if (!n) return -1;
  for (let i = 0; i < umbrales.length; i++) if (n <= umbrales[i]) return i;
  return umbrales.length - 1;
};

export const render = ({ output }) => {
  const dias = parsea(output);
  if (!dias) return <div className="aviso">Sin datos de Claude Code</div>;

  const hoy = new Date();
  const primerLunes = lunesDe(hoy);
  primerLunes.setDate(primerLunes.getDate() - (SEMANAS - 1) * 7);

  const celdas = [];
  const valores = [];
  for (let s = 0; s < SEMANAS; s++) {
    for (let d = 0; d < 7; d++) {
      const fecha = new Date(primerLunes);
      fecha.setDate(fecha.getDate() + s * 7 + d);
      const futuro = fecha > hoy;
      const n = futuro ? 0 : dias.get(clave(fecha)) || 0;
      if (!futuro) valores.push(n);
      celdas.push({ s, d, n, futuro, id: clave(fecha) });
    }
  }

  const umbrales = construyeUmbrales(valores);
  const total = valores.reduce((a, b) => a + b, 0);
  const activos = valores.filter((n) => n > 0).length;

  // Racha actual: días consecutivos con actividad hasta hoy.
  // Un hoy todavía a cero no rompe la racha de ayer.
  let racha = 0;
  let esHoy = true;
  for (let i = celdas.length - 1; i >= 0; i--) {
    const c = celdas[i];
    if (c.futuro) continue;
    if (c.n > 0) racha++;
    else if (!esHoy) break;
    esHoy = false;
  }

  const inicialesDia = ["L", "", "X", "", "V", "", ""];

  return (
    <div>
      <div className="cabecera">
        <span className="titulo">Claude Code</span>
        <span className="rango">
          {activos} días activos · racha {racha}
        </span>
        <span className="valor">
          {total >= 1000 ? (total / 1000).toFixed(1) : total}
          <span className="u">{total >= 1000 ? "k msg" : " msg"}</span>
        </span>
      </div>
      <svg
        className="rejilla"
        width={ANCHO}
        height={ALTO}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
      >
        {inicialesDia.map((t, d) =>
          t ? (
            <text
              key={d}
              x={MARGEN_IZQ - 6}
              y={d * PASO + LADO - 2}
              textAnchor="end"
              fontSize="8"
              fontWeight="500"
              style={{ fill: "var(--fg3)" }}
            >
              {t}
            </text>
          ) : null
        )}
        {celdas.map(({ s, d, n, futuro, id }) => {
          const nivel = nivelDe(n, umbrales);
          return (
            <rect
              key={id}
              x={MARGEN_IZQ + s * PASO}
              y={d * PASO}
              width={LADO}
              height={LADO}
              rx="2.5"
              fill={nivel < 0 ? "var(--track)" : "#fff"}
              fillOpacity={nivel < 0 ? (futuro ? 0.35 : 1) : NIVELES[nivel]}
            />
          );
        })}
      </svg>
    </div>
  );
};
