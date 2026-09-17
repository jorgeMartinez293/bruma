// Tips — 1x1, native macOS Tips widget look.
// One macOS tip a day, rotating through the list below. No data source: the
// day of the year picks the tip.
export const command = "date '+%j'";

export const refreshFrequency = 3600000; // 1 h

export const glass = true;

export const className = `
  top: 234px;
  left: 950px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --yellow: #E6A400;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.60);
    --yellow: #FFD60A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .head { display: flex; align-items: center; gap: 6px; }
  .app { font-size: 12px; font-weight: 700; color: var(--yellow); }
  .title {
    margin-top: 6px;
    font-size: 14px; font-weight: 700; line-height: 17px;
  }
  .body {
    margin-top: 4px;
    font-size: 11.5px; font-weight: 500; line-height: 15px; color: var(--fg2);
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4;
    overflow: hidden;
  }
`;

const TIPS = [
  ["Spotlight math", "Press ⌘Space and type a calculation or a unit conversion — the answer shows up in the result list."],
  ["Split View", "Hold the green full-screen button of a window to send it to the left or right half of the screen."],
  ["Quick Look", "Select a file in the Finder and press Space to preview it without opening an app."],
  ["Emoji picker", "Press ⌃⌘Space in any text field to bring up emoji and symbols."],
  ["Screenshot menu", "⇧⌘5 opens the capture bar: region, window, screen, and screen recording."],
  ["Hot corners", "System Settings → Desktop & Dock → Hot Corners puts Mission Control a flick away."],
  ["Clipboard history", "⌘⇧V pastes without formatting — it drops fonts and colours from the source."],
  ["Force quit", "⌥⌘Esc opens the Force Quit window when an app stops responding."],
  ["Rename in place", "Select a file and press Return to rename it; press Return again to commit."],
  ["Sidecar", "Use an iPad as a second display from Control Center → Screen Mirroring."],
  ["Text replacement", "System Settings → Keyboard → Text Replacements expands shorthand you type anywhere."],
  ["Stage Manager", "Turn it on in Control Center to keep one app centred and the rest tucked to the side."],
  ["Live Text", "Select text straight out of a photo or a screenshot — the cursor turns into an I-beam over it."],
  ["Dock spacer", "Drag an app out of the Dock until it puffs away to remove it; drop one back in to pin it."],
];

export const render = ({ output }) => {
  const day = parseInt((output || "").trim(), 10) || 1;
  const [title, body] = TIPS[day % TIPS.length];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="head">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 1.5a4.5 4.5 0 0 0-2.6 8.17V11a1 1 0 0 0 1 1h3.2a1 1 0 0 0 1-1V9.67A4.5 4.5 0 0 0 8 1.5z"
            style={{ fill: "var(--yellow)" }} />
          <rect x="6.2" y="12.6" width="3.6" height="1.5" rx="0.75" style={{ fill: "var(--yellow)" }} />
        </svg>
        <span className="app">Tips</span>
      </div>
      <div className="title">{title}</div>
      <div className="body">{body}</div>
    </div>
  );
};
