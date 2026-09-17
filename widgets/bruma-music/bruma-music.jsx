// Music (Now Playing) — 2x1, native macOS Music widget look.
// Whatever is playing in Spotify or Music: artwork, track, artist, progress.
//
// Reads the player over AppleScript, so macOS asks once for permission to
// control Spotify / Music. Artwork only comes through for Spotify (Music.app
// hands out raw image data, not a URL), so Music gets the drawn placeholder.
export const command = `
out=""
if pgrep -x Spotify > /dev/null 2>&1; then
  out=$(osascript <<'APPLESCRIPT' 2>/dev/null
tell application "Spotify"
  if player state is stopped then return ""
  set t to current track
  return "Spotify" & tab & (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & (player position as integer) & tab & ((duration of t) / 1000 as integer) & tab & (artwork url of t)
end tell
APPLESCRIPT
)
fi
if [ -z "$out" ] && pgrep -x Music > /dev/null 2>&1; then
  out=$(osascript <<'APPLESCRIPT' 2>/dev/null
tell application "Music"
  if player state is stopped then return ""
  set t to current track
  return "Music" & tab & (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & (player position as integer) & tab & ((duration of t) as integer) & tab & ""
end tell
APPLESCRIPT
)
fi
printf '%s' "$out"
`;

export const refreshFrequency = 2000; // 2 s, so the progress bar moves

export const glass = true;

export const className = `
  top: 420px;
  left: 20px;
  width: 366px;
  height: 170px;
  box-sizing: border-box;
  padding: 16px 18px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --fg3: rgba(0,0,0,0.34);
  --track: rgba(0,0,0,0.14);
  --art: rgba(0,0,0,0.08);
  --pink: #FA2B56;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.40);
    --track: rgba(255,255,255,0.18);
    --art: rgba(255,255,255,0.10);
    --pink: #FF375F;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  gap: 14px;

  .art {
    width: 92px; height: 92px; border-radius: 10px; flex: none;
    background: var(--art); overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.20);
  }
  .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .app { font-size: 11px; font-weight: 600; color: var(--pink); }
  .title {
    font-size: 15px; font-weight: 700; line-height: 18px; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .artist {
    font-size: 12px; font-weight: 500; color: var(--fg2); line-height: 15px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .album {
    font-size: 11px; font-weight: 500; color: var(--fg3); line-height: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .bar { margin-top: auto; height: 4px; border-radius: 2px; background: var(--track); }
  .bar i { display: block; height: 100%; border-radius: 2px; background: var(--fg); }
  .times {
    display: flex; justify-content: space-between; margin-top: 4px;
    font-size: 10px; font-weight: 600; color: var(--fg3);
    font-variant-numeric: tabular-nums;
  }
  .empty { margin: auto; text-align: center; color: var(--fg2);
    font-size: 13px; font-weight: 500; }
`;

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const Placeholder = () => (
  <svg width="92" height="92" viewBox="0 0 92 92" style={{ display: "block" }}>
    <rect width="92" height="92" rx="10" style={{ fill: "var(--art)" }} />
    <g style={{ fill: "var(--fg3)" }}>
      <path d="M56 26v28.5a8 8 0 1 1-4-6.93V33.6l-18 3.8v21.1a8 8 0 1 1-4-6.93V32l26-6z" />
    </g>
  </svg>
);

export const render = ({ output }) => {
  const f = (output || "").trim().split("\t");
  if (f.length < 7)
    return (
      <div style={{ height: "100%", display: "flex" }}>
        <div className="empty">Nothing playing</div>
      </div>
    );

  const [app, state, title, artist, album, posS, durS, art] = f;
  const pos = parseFloat(posS) || 0;
  const dur = parseFloat(durS) || 0;
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div style={{ height: "100%", display: "flex", gap: "14px" }}>
      <div className="art">{art ? <img src={art} alt="" /> : <Placeholder />}</div>
      <div className="info">
        <div className="app">{app}{state === "paused" ? " · Paused" : ""}</div>
        <div className="title">{title}</div>
        <div className="artist">{artist}</div>
        <div className="album">{album}</div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="times"><span>{mmss(pos)}</span><span>{mmss(dur)}</span></div>
      </div>
    </div>
  );
};
