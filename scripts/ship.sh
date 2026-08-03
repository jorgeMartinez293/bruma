#!/usr/bin/env bash
# One-command release for bruma: build + package + sign + appcast, then publish
# EVERYTHING. Mirrors vaho's app/scripts/ship.sh.
#
# Usage: scripts/ship.sh <short-version>      e.g. scripts/ship.sh 1.1
#        RESUME=1 scripts/ship.sh <short-version>
#          → skip step 1 and publish the artifacts already in dist/. Use this when
#            a run died after the build (dmg, gh, Pages…) so a finished, notarized
#            build gets published instead of rebuilt and re-bumped.
#
#   1. release.sh <version>  → bumps version, builds, signs, zips, deltas, appcast, dmg.
#   2. Source repo: commit the version bump, tag v<version>, push main + tag.
#   3. Release repo (jorgeMartinez293/bruma-releases): create GitHub Release and
#      upload the new .zip, .dmg and .delta assets.
#   4. Publish dist/appcast.xml to the release repo's gh-pages (the SUFeedURL host)
#      AND main.
#   5. Verify the live appcast serves the new build before declaring success.
#
# Requirements: `gh` authenticated and the private EdDSA key in your Keychain
# (the same one vaho uses — one key signs the whole family).
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

APP=bruma
VERSION="${1:-}"
if [ -z "$VERSION" ]; then echo "Usage: $0 <short-version>  (e.g. 1.1)" >&2; exit 1; fi

RELEASE_REPO="jorgeMartinez293/$APP-releases"
DIST="$APP_DIR/dist"
PLIST="$APP_DIR/Info.plist"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ── Pre-flight ────────────────────────────────────────────────────────────────
gh auth status >/dev/null 2>&1 || { echo "ERROR: run 'gh auth login' first." >&2; exit 1; }
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "ERROR: tag v$VERSION already exists locally. Bump to a new version." >&2; exit 1
fi

# ── 1. Build + package + appcast + dmg ─────────────────────────────────────────
# RESUME=1 reuses whatever release.sh already produced in dist/ instead of running
# it again. Everything before this point in a release is cheap; release.sh is not
# — it bumps CFBundleVersion, does a universal build, and waits on Apple's notary
# queue. So when a later step fails (a broken dmg, an expired gh token, a Pages
# hiccup), re-running from scratch burns all of that AND bumps the build number
# again for a binary nobody ever saw. Resuming publishes the artifacts that are
# already sitting there, verified below.
if [ "${RESUME:-0}" = "1" ]; then
  say "RESUME=1 — reusing existing artifacts in dist/ (no rebuild, no version bump)"
  PLIST_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST")
  [ "$PLIST_VERSION" = "$VERSION" ] || {
    echo "ERROR: RESUME=1 but Info.plist says v$PLIST_VERSION, not v$VERSION." >&2
    echo "       Those artifacts are for a different version — rerun without RESUME." >&2
    exit 1; }
else
  say "Building & packaging $APP v$VERSION"
  "$APP_DIR/scripts/release.sh" "$VERSION"
fi

BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$PLIST")
ZIP="$DIST/$APP-$VERSION.zip"
DMG="$DIST/$APP.dmg"
[ -f "$ZIP" ] || { echo "ERROR: $ZIP missing after build." >&2; exit 1; }
[ -f "$DMG" ] || { echo "ERROR: $DMG missing after build." >&2; exit 1; }
[ -f "$DIST/appcast.xml" ] || { echo "ERROR: $DIST/appcast.xml missing after build." >&2; exit 1; }

# The appcast is what every installed copy reads, so it must actually advertise the
# build we are about to publish. On a resumed run it may be stale from an earlier
# attempt; catching that here beats shipping a release nobody is offered.
grep -q "<sparkle:version>$BUILD</sparkle:version>" "$DIST/appcast.xml" || {
  echo "ERROR: $DIST/appcast.xml does not advertise build $BUILD." >&2
  echo "       Regenerate it (scripts/release.sh) before publishing." >&2; exit 1; }

# Gatekeeper checks the app and the dmg separately, and an unstapled build shows the
# "damaged / unidentified developer" dialog on first launch. NOTARIZE=0 builds are for
# local testing only and must never reach the release repo — fail loudly if one does.
if [ "${NOTARIZE:-1}" = "1" ]; then
  xcrun stapler validate "$APP_DIR/$APP.app" >/dev/null 2>&1 || {
    echo "ERROR: $APP.app has no notarization ticket stapled — refusing to publish." >&2; exit 1; }
  xcrun stapler validate "$DMG" >/dev/null 2>&1 || {
    echo "ERROR: $DMG has no notarization ticket stapled — refusing to publish." >&2; exit 1; }
fi
DELTAS=("$DIST/$APP$BUILD"-*.delta)
[ -e "${DELTAS[0]}" ] || DELTAS=()   # first release ever has no delta

# Every file the appcast points at must exist in dist/, or Sparkle hands users a 404
# mid-update. This catches an appcast that still advertises an archive since deleted —
# exactly how a leftover create-dmg scratch file once got published as a real update.
while read -r ENC; do
  [ -f "$DIST/$ENC" ] || {
    echo "ERROR: appcast.xml references '$ENC', which is not in $DIST." >&2
    echo "       Regenerate the appcast before publishing." >&2; exit 1; }
done < <(grep -o 'download/[^"]*' "$DIST/appcast.xml" | sed 's|^download/||' | sort -u)

# ── 2. Commit + tag + push source repo ─────────────────────────────────────────
say "Committing & tagging source repo"
git add -A
git commit -q -m "release: v$VERSION" || echo "(nothing new to commit)"
git tag "v$VERSION"
git push origin HEAD
git push origin "v$VERSION"

# ── 3. GitHub Release on the release repo ──────────────────────────────────────
say "Publishing GitHub Release v$VERSION on $RELEASE_REPO"
# macOS bash 3.2 + set -u: expanding an empty array errors; guard the deltas.
ASSETS=("$ZIP" "$DMG" ${DELTAS[@]+"${DELTAS[@]}"})
if gh release view "v$VERSION" -R "$RELEASE_REPO" >/dev/null 2>&1; then
  gh release upload "v$VERSION" "${ASSETS[@]}" -R "$RELEASE_REPO" --clobber
else
  gh release create "v$VERSION" "${ASSETS[@]}" -R "$RELEASE_REPO" \
    --title "v$VERSION" --notes "$APP $VERSION"
fi

# ── 4. Publish appcast to gh-pages (the SUFeedURL host) ─────────────────────────
say "Publishing appcast.xml to $RELEASE_REPO (gh-pages + main)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
gh repo clone "$RELEASE_REPO" "$WORK" -- -q
cd "$WORK"
git config user.email "$(cd "$APP_DIR" && git config user.email)"
git config user.name  "$(cd "$APP_DIR" && git config user.name)"
for BR in gh-pages main; do
  git checkout -q "$BR"
  cp "$DIST/appcast.xml" appcast.xml
  # `git diff --quiet` misses a brand-new (untracked) appcast.xml — stage first
  # and compare the index, so the very first publication also gets pushed.
  git add appcast.xml
  if ! git diff --cached --quiet; then
    git commit -q -m "Publish v$VERSION appcast (build $BUILD)"
    git push -q origin "$BR"
    echo "  pushed appcast → $BR"
  else
    echo "  $BR already up to date"
  fi
done
cd "$APP_DIR"

# ── 5. Verify the live appcast serves the new build ────────────────────────────
say "Verifying live appcast (GitHub Pages may take up to ~1 min to rebuild)"
FEED=$(/usr/libexec/PlistBuddy -c "Print :SUFeedURL" "$PLIST")
for i in $(seq 1 12); do
  LIVE=$(curl -s -H 'Cache-Control: no-cache' "$FEED?nocache=$RANDOM" || true)
  if printf '%s' "$LIVE" | grep -q "<sparkle:version>$BUILD</sparkle:version>"; then
    echo "  ✅ Live appcast advertises build $BUILD (v$VERSION)."
    for f in "$APP-$VERSION.zip" "$APP.dmg"; do
      code=$(curl -s -o /dev/null -w '%{http_code}' -L \
        "https://github.com/$RELEASE_REPO/releases/latest/download/$f")
      echo "  $f → HTTP $code"
    done
    say "DONE — $APP v$VERSION is live."
    exit 0
  fi
  echo "  attempt $i/12: not live yet, waiting 10s…"; sleep 10
done
echo "WARNING: live appcast did not show build $BUILD within ~2 min." >&2
echo "Assets and git are pushed; Pages may just be slow. Re-check: $FEED" >&2
exit 1
