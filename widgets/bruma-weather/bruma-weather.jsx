// Weather — 1x1, native macOS Weather widget look.
// Background: native Liquid Glass (glass = true); theme-aware colors.
// Data: wttr.in (free, no key). Set LOCATION below, or leave it empty to let
// the service geolocate this IP. Needs `jq` (ships with macOS 15+).
const LOCATION = ""; // e.g. "Madrid", "40.4,-3.7", "" = auto

export const command = `
  curl -s -m 10 "https://wttr.in/${LOCATION}?format=j1" |
  jq -r '[ .nearest_area[0].areaName[0].value,
           .current_condition[0].temp_C,
           .current_condition[0].weatherCode,
           .current_condition[0].weatherDesc[0].value,
           .weather[0].maxtempC,
           .weather[0].mintempC ] | @tsv'
`;

export const refreshFrequency = 900000; // 15 min

export const glass = true;

export const className = `
  top: 48px;
  left: 392px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.55);
  --sun: #FFB400;
  --cloud: rgba(0,0,0,0.45);
  --rain: #0A84FF;
  --bolt: #FFCC00;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.62);
    --sun: #FFD60A;
    --cloud: rgba(255,255,255,0.70);
    --rain: #64D2FF;
    --bolt: #FFD60A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .top { display: flex; align-items: flex-start; gap: 6px; }
  .top .left { flex: 1; min-width: 0; }
  .place {
    font-size: 13px; font-weight: 600; line-height: 16px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .temp {
    font-size: 36px; font-weight: 300; line-height: 40px;
    font-variant-numeric: tabular-nums; letter-spacing: -1px;
  }
  .icon { margin-left: auto; flex: none; }
  .desc {
    margin-top: auto;
    font-size: 12px; font-weight: 600; color: var(--fg2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .hilo { font-size: 12px; font-weight: 600; color: var(--fg2); }
  .notice { margin: auto; font-size: 12px; font-weight: 500; color: var(--fg2); }
`;

// WWO weather codes grouped into the seven pictograms below.
export const kind = (code) => {
  const c = parseInt(code, 10);
  if ([395, 392, 389, 386, 200].includes(c)) return "thunder";
  if ([227, 230, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377, 179, 182, 185].includes(c)) return "snow";
  if ([299, 302, 305, 308, 311, 314, 317, 320, 356, 359, 362, 365].includes(c)) return "rain";
  if ([176, 263, 266, 281, 284, 293, 296, 353].includes(c)) return "drizzle";
  if ([143, 248, 260].includes(c)) return "fog";
  if ([119, 122].includes(c)) return "cloud";
  if ([116].includes(c)) return "partly";
  return "clear";
};

// One SVG pictogram, drawn at a 44x44 box scaled by `s`.
export const Icon = ({ kind: k, size = 44, night = false }) => {
  const cloud = (
    <path
      d="M13 31h17a7 7 0 0 0 .6-13.96A9.5 9.5 0 0 0 12.4 19 6 6 0 0 0 13 31z"
      style={{ fill: "var(--cloud)" }}
    />
  );
  const sun = (cx, cy, r) => (
    <g>
      <circle cx={cx} cy={cy} r={r} style={{ fill: "var(--sun)" }} />
      {[...Array(8)].map((_, i) => {
        const a = (i * 45) * Math.PI / 180;
        return (
          <line
            key={i}
            x1={cx + (r + 2.5) * Math.sin(a)} y1={cy - (r + 2.5) * Math.cos(a)}
            x2={cx + (r + 5.5) * Math.sin(a)} y2={cy - (r + 5.5) * Math.cos(a)}
            style={{ stroke: "var(--sun)" }} strokeWidth="2" strokeLinecap="round"
          />
        );
      })}
    </g>
  );
  const moon = (cx, cy, r) => (
    <path
      d={`M${cx + r * 0.55} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.75} ${r * 1.5}
          a${r * 0.85} ${r * 0.85} 0 1 1 ${-r * 0.75} ${-r * 1.5} z`}
      style={{ fill: "var(--sun)" }}
    />
  );
  const drops = (n, heavy) =>
    [...Array(n)].map((_, i) => (
      <line
        key={i}
        x1={15 + i * 7} y1={34} x2={12.5 + i * 7} y2={heavy ? 41 : 38.5}
        style={{ stroke: "var(--rain)" }} strokeWidth="2.4" strokeLinecap="round"
      />
    ));

  let body;
  if (k === "clear") body = night ? moon(22, 22, 11) : sun(22, 22, 10);
  else if (k === "partly")
    body = <g>{night ? moon(16, 15, 8) : sun(16, 15, 7.5)}{cloud}</g>;
  else if (k === "cloud") body = cloud;
  else if (k === "fog")
    body = (
      <g>
        {cloud}
        {[0, 1, 2].map((i) => (
          <line key={i} x1={10 + (i % 2) * 3} y1={35 + i * 3.5} x2={34 - (i % 2) * 3} y2={35 + i * 3.5}
            style={{ stroke: "var(--cloud)" }} strokeWidth="2.2" strokeLinecap="round" />
        ))}
      </g>
    );
  else if (k === "drizzle") body = <g>{cloud}{drops(3, false)}</g>;
  else if (k === "rain") body = <g>{cloud}{drops(4, true)}</g>;
  else if (k === "snow")
    body = (
      <g>
        {cloud}
        {[0, 1, 2].map((i) => (
          <g key={i} style={{ stroke: "var(--rain)" }} strokeWidth="2" strokeLinecap="round">
            <line x1={15 + i * 7} y1={35} x2={15 + i * 7} y2={40} />
            <line x1={12.6 + i * 7} y1={36.2} x2={17.4 + i * 7} y2={38.8} />
            <line x1={17.4 + i * 7} y1={36.2} x2={12.6 + i * 7} y2={38.8} />
          </g>
        ))}
      </g>
    );
  else body = cloud;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ display: "block" }}>
      {body}
      {k === "thunder" && (
        <g>
          {cloud}
          <path d="M22 32l-6 9h5l-2 8 9-11h-5l3-6z" style={{ fill: "var(--bolt)" }} />
        </g>
      )}
    </svg>
  );
};

const isNight = () => { const h = new Date().getHours(); return h < 7 || h >= 20; };

export const render = ({ output }) => {
  const parts = (output || "").trim().split("\t");
  if (parts.length < 6) return <div className="notice">No weather</div>;
  const [place, temp, code, desc, hi, lo] = parts;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="top">
        <div className="left">
          <div className="place">{place}</div>
          <div className="temp">{temp}°</div>
        </div>
        <div className="icon"><Icon kind={kind(code)} night={isNight()} /></div>
      </div>
      <div className="desc">{desc}</div>
      <div className="hilo">H:{hi}° L:{lo}°</div>
    </div>
  );
};
