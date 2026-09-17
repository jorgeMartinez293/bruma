// Featured Photo — 1x1, native macOS Photos widget look.
// Picks a random picture from a folder every half hour and shows it edge to
// edge under a soft gradient with its file name.
//
// PHOTO_DIR is a plain folder, not the Photos library (that one is a sealed
// bundle): point it at ~/Pictures, an album you export, or any folder of
// images. The picture is scaled down into $TMPDIR before it is shown, so the
// widget never inlines a 40-megapixel original.
const PHOTO_DIR = "$HOME/Pictures";

export const command = `
  DIR="${PHOTO_DIR}"
  F=$(find "$DIR" -maxdepth 4 \\( -name '*.photoslibrary' -o -name '.*' \\) -prune -o \\
        -type f \\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \\) -print 2>/dev/null |
      sort -R | head -1)
  [ -n "$F" ] || exit 0
  OUT="$TMPDIR/bruma-photo.jpg"
  sips -Z 400 -s format jpeg "$F" --out "$OUT" > /dev/null 2>&1 || exit 0
  printf '%s\\t' "$(basename "$F")"
  base64 -i "$OUT" | tr -d '\\n'
`;

export const refreshFrequency = 1800000; // 30 min

export const glass = true;

export const className = `
  top: 420px;
  left: 950px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg2: rgba(0,0,0,0.52);
  @media (prefers-color-scheme: dark) { --fg2: rgba(255,255,255,0.58); }

  position: relative;

  /* bruma mounts the widget inside .widget-body; make it fill the box. */
  .widget-body { height: 100%; }

  img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    border-radius: 24px;
  }
  .shade {
    position: absolute; inset: auto 0 0 0; height: 62px;
    background: linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0));
    border-radius: 0 0 24px 24px;
  }
  .name {
    position: absolute; left: 12px; right: 12px; bottom: 10px;
    color: #fff; font-size: 11px; font-weight: 600;
    text-shadow: 0 1px 2px rgba(0,0,0,0.4);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .notice {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 0 18px; text-align: center;
    color: var(--fg2); font-size: 12px; font-weight: 500; line-height: 16px;
  }
`;

export const render = ({ output }) => {
  const raw = (output || "").trim();
  const tab = raw.indexOf("\t");
  if (tab < 0) return <div className="notice">No pictures found in the folder</div>;

  const name = raw.slice(0, tab);
  const data = raw.slice(tab + 1);

  return (
    <div>
      <img src={`data:image/jpeg;base64,${data}`} alt="" />
      <div className="shade" />
      <div className="name">{name.replace(/\.[^.]+$/, "")}</div>
    </div>
  );
};
