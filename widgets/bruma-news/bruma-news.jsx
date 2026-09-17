// News — 2x1, native macOS News widget look.
// Top stories from any RSS feed. Apple News has no public API, so the feed is
// yours to pick: change FEED below (any RSS/Atom URL works).
const FEED = "https://feeds.bbci.co.uk/news/world/rss.xml";

export const command = `
  F="$TMPDIR/bruma-news.xml"
  curl -s -m 10 -L "${FEED}" -o "$F" || exit 0
  xmllint --xpath "string(//channel/title)" "$F" 2>/dev/null | tr -d '\\n'
  echo
  for i in 1 2 3; do
    t=$(xmllint --xpath "string((//item|//entry)[$i]/title)" "$F" 2>/dev/null | tr -d '\\n')
    d=$(xmllint --xpath "string((//item|//entry)[$i]/pubDate)" "$F" 2>/dev/null | tr -d '\\n')
    [ -n "$t" ] && printf '%s\\t%s\\n' "$t" "$d"
  done
`;

export const refreshFrequency = 900000; // 15 min

export const glass = true;

export const className = `
  top: 792px;
  left: 392px;
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
  --line: rgba(0,0,0,0.10);
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --fg3: rgba(255,255,255,0.38);
    --line: rgba(255,255,255,0.14);
    --red: #FF453A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);

  .head { display: flex; align-items: baseline; gap: 6px; }
  .source {
    font-size: 12px; font-weight: 700; color: var(--red); letter-spacing: 0.2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .label { margin-left: auto; font-size: 10px; font-weight: 600; color: var(--fg3); }
  .story { padding: 5px 0; border-top: 1px solid var(--line); }
  .story:first-of-type { border-top: none; padding-top: 3px; }
  .title {
    font-size: 11.5px; font-weight: 600; line-height: 14px;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .when { font-size: 10px; font-weight: 500; color: var(--fg3); margin-top: 1px; }
  .notice { height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--fg2); font-size: 13px; font-weight: 500; }
`;

const ago = (date) => {
  if (!date || isNaN(date)) return "";
  const mins = Math.round((Date.now() - date) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

export const render = ({ output }) => {
  const lines = (output || "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return <div className="notice">No stories</div>;

  const source = lines[0].trim();
  const stories = lines.slice(1).map((l) => {
    const [title, date] = l.split("\t");
    return { title, when: ago(new Date(date)) };
  });

  return (
    <div>
      <div className="head">
        <span className="source">{source}</span>
        <span className="label">TOP STORIES</span>
      </div>
      {stories.slice(0, 3).map((s, i) => (
        <div className="story" key={i}>
          <div className="title">{s.title}</div>
          {i === 0 && s.when ? <div className="when">{s.when}</div> : null}
        </div>
      ))}
    </div>
  );
};
