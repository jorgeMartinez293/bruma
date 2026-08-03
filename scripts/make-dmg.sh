#!/usr/bin/env bash
# Build the distributable dmg: a read-write image, laid out in Finder, then
# converted to a compressed read-only image.
#
# Usage: scripts/make-dmg.sh <app-bundle> <output.dmg> <volume-name>
#
# WHY THIS EXISTS INSTEAD OF create-dmg
# ------------------------------------
# create-dmg (1.3.0, the current release) prettifies the window with an
# AppleScript template that sets `statusbar visible` on the Finder container
# window. macOS 26 (Tahoe) dropped that property, so Finder answers -10006
# ("Can't set statusbar visible of container window of disk …"), create-dmg
# treats it as fatal, and the release dies AFTER the build and the notarization
# round-trip have already been paid for. There is no flag to skip only that
# line: --skip-jenkins and --sandbox-safe skip the whole layout, which loses the
# icon positions and the /Applications drop link.
#
# So we do the same job here, minus the property Finder no longer has. Layout is
# best-effort: if Finder refuses (headless session, no Automation permission),
# we log it and still ship a working dmg rather than failing the release.
set -euo pipefail

APP="${1:?usage: make-dmg.sh <app-bundle> <output.dmg> <volume-name>}"
OUT="${2:?usage: make-dmg.sh <app-bundle> <output.dmg> <volume-name>}"
VOLNAME="${3:?usage: make-dmg.sh <app-bundle> <output.dmg> <volume-name>}"

[ -d "$APP" ] || { echo "ERROR: $APP not found — run 'make release' first." >&2; exit 1; }

WINW=500; WINH=320; ICON_SIZE=96
APP_X=120; APP_Y=130      # bundle icon
LINK_X=380; LINK_Y=130    # /Applications drop link

STAGING="$(mktemp -d)"
RW_DMG="$(mktemp -u -t bruma-rw).dmg"
DEVICE=""

cleanup() {
  # Order matters: detach before deleting, or the image file stays busy.
  [ -n "$DEVICE" ] && hdiutil detach "$DEVICE" -quiet -force 2>/dev/null || true
  rm -rf "$STAGING" "$RW_DMG"
}
trap cleanup EXIT

# A leftover mount from an interrupted run would make Finder lay out the WRONG
# disk (the new one mounts as "bruma 1"), so clear it first.
if [ -d "/Volumes/$VOLNAME" ]; then
  echo "Detaching stale /Volumes/$VOLNAME"
  hdiutil detach "/Volumes/$VOLNAME" -quiet -force 2>/dev/null || true
fi

echo "Staging $APP"
cp -R "$APP" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

# Size the image with slack: HFS+ metadata and the .DS_Store Finder writes during
# layout need room beyond the payload, and a full volume fails the layout step.
SIZE_MB=$(( $(du -sm "$STAGING" | cut -f1) + 50 ))

echo "Creating read-write image (${SIZE_MB}M)"
hdiutil create -srcfolder "$STAGING" -volname "$VOLNAME" -fs HFS+ \
  -format UDRW -size "${SIZE_MB}m" -ov -quiet "$RW_DMG"

echo "Mounting"
ATTACH=$(hdiutil attach "$RW_DMG" -readwrite -noverify -noautoopen)
DEVICE=$(printf '%s' "$ATTACH" | grep -Eo '^/dev/disk[0-9]+' | head -1)
MOUNT_DIR=$(printf '%s' "$ATTACH" | grep -Eo '/Volumes/.*$' | head -1)
[ -n "$DEVICE" ] && [ -n "$MOUNT_DIR" ] || { echo "ERROR: could not mount $RW_DMG" >&2; exit 1; }
# Finder addresses the disk by its mounted name, which is NOT always $VOLNAME —
# a name collision mounts it as "bruma 1".
DISK_NAME=$(basename "$MOUNT_DIR")
echo "Mounted $DEVICE at $MOUNT_DIR"

echo "Laying out window in Finder"
if ! osascript - "$DISK_NAME" "$(basename "$APP")" \
     "$WINW" "$WINH" "$ICON_SIZE" "$APP_X" "$APP_Y" "$LINK_X" "$LINK_Y" <<'APPLESCRIPT'
on run argv
	set diskName to item 1 of argv
	set appName to item 2 of argv
	-- argv items arrive as text; Finder geometry needs integers.
	set winW to (item 3 of argv) as integer
	set winH to (item 4 of argv) as integer
	set iconSize to (item 5 of argv) as integer
	set appX to (item 6 of argv) as integer
	set appY to (item 7 of argv) as integer
	set linkX to (item 8 of argv) as integer
	set linkY to (item 9 of argv) as integer

	tell application "Finder"
		tell disk diskName
			open
			tell container window
				set current view to icon view
				set toolbar visible to false
				-- NOTE: no `statusbar visible` here. Finder on macOS 26 has no such
				-- property and errors -10006; that is the bug this script exists for.
				set the bounds to {200, 120, 200 + winW, 120 + winH}
			end tell
			set opts to the icon view options of container window
			tell opts
				set icon size to iconSize
				set text size to 12
				set arrangement to not arranged
			end tell
			set position of item appName of container window to {appX, appY}
			set position of item "Applications" of container window to {linkX, linkY}
			set extension hidden of item appName of container window to true
			close
			open
			-- Give Finder time to flush .DS_Store; without it the layout is lost.
			delay 3
			close
		end tell
	end tell
end run
APPLESCRIPT
then
  echo "WARNING: Finder layout failed — shipping an unstyled but working dmg." >&2
fi

sync
echo "Detaching"
hdiutil detach "$DEVICE" -quiet
DEVICE=""

echo "Compressing to $OUT"
rm -f "$OUT"
mkdir -p "$(dirname "$OUT")"
hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$OUT" -quiet

echo "Built $OUT"
