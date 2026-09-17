// Screen Time — 2x1, native macOS Screen Time widget look.
// Today's app usage, read straight from the system's knowledge store.
//
// The store is protected: bruma.app (or the terminal running `swift run`) needs
// Full Disk Access in System Settings → Privacy & Security. Without it the
// widget says so instead of showing numbers.
export const command = `
  DB="$HOME/Library/Application Support/Knowledge/knowledgeC.db"
  sqlite3 -separator "$(printf '\\t')" "$DB" "
    SELECT ZVALUESTRING, CAST(SUM(ZENDDATE - ZSTARTDATE) AS INT)
    FROM ZOBJECT
    WHERE ZSTREAMNAME = '/app/usage'
      AND ZSTARTDATE > (strftime('%s', datetime('now','localtime','start of day'), 'utc') - 978307200)
    GROUP BY ZVALUESTRING
    ORDER BY 2 DESC
    LIMIT 6;" 2>&1
`;

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 792px;
  left: 764px;
  width: 366px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 18px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --fg3: rgba(0,0,0,0.34);
  --track: rgba(0,0,0,0.10);
  --indigo: #5E5CE6;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --track: rgba(255,255,255,0.14);
    --indigo: #7D7AFF;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .head { display: flex; align-items: baseline; gap: 8px; }
  .title { font-size: 13px; font-weight: 600; color: var(--fg2); }
  .total {
    margin-left: auto;
    font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .total .u { font-size: 12px; font-weight: 600; color: var(--fg2); }
  .list {
    margin-top: 8px; display: flex; flex-direction: column; gap: 8px;
    overflow: hidden;
  }
  .app { display: flex; align-items: center; gap: 8px; }
  .name {
    width: 120px; flex: none;
    font-size: 11.5px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .bar { flex: 1; height: 8px; border-radius: 4px; background: var(--track); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 4px; background: var(--indigo); }
  .time {
    width: 48px; flex: none; text-align: right;
    font-size: 11px; font-weight: 600; color: var(--fg2);
    font-variant-numeric: tabular-nums;
  }
  .notice {
    margin: auto; max-width: 280px; text-align: center;
    font-size: 12px; font-weight: 500; color: var(--fg2); line-height: 16px;
  }
`;

// Bundle ids the system reports, prettified. Anything else falls back to the
// last dot-separated component.
const NAMES = {
  "com.apple.Safari": "Safari",
  "com.apple.finder": "Finder",
  "com.apple.mail": "Mail",
  "com.apple.dt.Xcode": "Xcode",
  "com.apple.Terminal": "Terminal",
  "com.apple.systempreferences": "System Settings",
  "com.apple.MobileSMS": "Messages",
  "com.apple.iCal": "Calendar",
  "com.apple.Notes": "Notes",
  "com.apple.Music": "Music",
  "com.apple.Preview": "Preview",
  "com.google.Chrome": "Chrome",
  "com.spotify.client": "Spotify",
  "com.tinyspeck.slackmacgap": "Slack",
  "com.microsoft.VSCode": "Visual Studio Code",
  "com.figma.Desktop": "Figma",
};

const pretty = (id) => {
  if (NAMES[id]) return NAMES[id];
  const last = (id || "").split(".").pop() || id;
  return last.charAt(0).toUpperCase() + last.slice(1);
};

const hm = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const render = ({ output }) => {
  const raw = (output || "").trim();

  if (/unable to open|authorization denied|Error:/i.test(raw))
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="head"><span className="title">Screen Time</span></div>
        <div className="notice">
          Give bruma Full Disk Access (System Settings → Privacy &amp; Security)
          to read the system usage store.
        </div>
      </div>
    );

  const apps = raw.split("\n").filter(Boolean)
    .map((l) => {
      const [id, secs] = l.split("\t");
      return { name: pretty(id), secs: parseInt(secs, 10) || 0 };
    })
    .filter((a) => a.secs > 60);

  if (!apps.length)
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="head"><span className="title">Screen Time</span></div>
        <div className="notice">No usage recorded yet today.</div>
      </div>
    );

  const total = apps.reduce((s, a) => s + a.secs, 0);
  const max = apps[0].secs;

  return (
    <div>
      <div className="head">
        <span className="title">Screen Time</span>
        <span className="total">
          {hm(total).split(" ")[0]}
          <span className="u">{hm(total).split(" ")[1] ? " " + hm(total).split(" ")[1] : ""}</span>
        </span>
      </div>
      <div className="list">
        {apps.slice(0, 4).map((a, i) => (
          <div className="app" key={i}>
            <span className="name">{a.name}</span>
            <span className="bar"><i style={{ width: `${(a.secs / max) * 100}%` }} /></span>
            <span className="time">{hm(a.secs)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
