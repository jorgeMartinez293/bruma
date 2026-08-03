# Makefile for bruma (familia vaho)

APP_NAME = bruma
EXECUTABLE = Bruma
# Universal (arm64 + x86_64) products land here instead of .build/release.
BUILD_DIR = .build/apple/Products/Release
APP_BUNDLE = $(APP_NAME).app
PLIST = Info.plist
ICON = icon.icns

# Signing identity, in order of preference:
#   1. Developer ID Application — the only identity other Macs accept and the only one Apple
#      will notarize. Everything we ship must use it.
#   2. Apple Development — local fallback for a machine without the Developer ID cert.
#   3. Ad-hoc ("-") — cdhash-only designated requirement, which CHANGES every build and so
#      silently voids any TCC grant on each rebuild.
# `find-identity -v` also lists REVOKED certs (CSSMERR_TP_CERT_REVOKED); filter them or
# codesign fails late with a confusing error. `make SIGN_IDENTITY=-` forces ad-hoc.
IDENTITIES = security find-identity -v -p codesigning 2>/dev/null | grep -v CSSMERR_TP_CERT_REVOKED
SIGN_IDENTITY ?= $(shell $(IDENTITIES) | grep -m1 -o '"Developer ID Application: [^"]*"' | tr -d '"')
ifeq ($(strip $(SIGN_IDENTITY)),)
SIGN_IDENTITY := $(shell $(IDENTITIES) | grep -m1 -o '"Apple Development: [^"]*"' | tr -d '"')
endif
ifeq ($(strip $(SIGN_IDENTITY)),)
SIGN_IDENTITY := -
endif

# Hardened runtime + secure timestamp: both hard requirements for notarization. bruma needs
# no entitlements alongside them — it does no dlopen of foreign dylibs, no AppleScript and
# no JIT, which are the things hardened runtime would otherwise block.
# Skipped for ad-hoc: --timestamp round-trips to Apple and simply fails offline.
ifeq ($(SIGN_IDENTITY),-)
CODESIGN_FLAGS =
else
CODESIGN_FLAGS = --options runtime --timestamp
endif

all: build package
release: build package

build:
	swift build -c release --arch arm64 --arch x86_64

package:
	@echo "Packaging $(APP_BUNDLE)..."
	rm -rf $(APP_BUNDLE)
	mkdir -p $(APP_BUNDLE)/Contents/MacOS
	mkdir -p $(APP_BUNDLE)/Contents/Resources
	mkdir -p $(APP_BUNDLE)/Contents/Frameworks
	cp $(BUILD_DIR)/$(EXECUTABLE) $(APP_BUNDLE)/Contents/MacOS/
	cp $(PLIST) $(APP_BUNDLE)/Contents/Info.plist
	cp $(ICON) $(APP_BUNDLE)/Contents/Resources/AppIcon.icns
	# SwiftPM resource bundle (Bundle.module — the widget runtime). The generated
	# accessor looks in Contents/Resources first (Bundle.main.resourceURL).
	cp -R $(BUILD_DIR)/$(EXECUTABLE)_$(EXECUTABLE).bundle $(APP_BUNDLE)/Contents/Resources/
	chmod +x $(APP_BUNDLE)/Contents/MacOS/$(EXECUTABLE)
	# Embed Sparkle.framework (auto-update): swift build links against it but doesn't
	# copy it into the bundle, and Sparkle can't run from outside the app.
	@SPARKLE_FW=$$(find .build -maxdepth 8 -name 'Sparkle.framework' -type d | head -1); \
	if [ -z "$$SPARKLE_FW" ]; then echo "ERROR: Sparkle.framework not found in .build"; exit 1; fi; \
	cp -R "$$SPARKLE_FW" $(APP_BUNDLE)/Contents/Frameworks/
	install_name_tool -add_rpath @executable_path/../Frameworks $(APP_BUNDLE)/Contents/MacOS/$(EXECUTABLE) 2>/dev/null || true
	# Sign inner-out. NOT `--deep`: Apple documents it as unsuitable for distribution because
	# it re-signs nested code with the OUTER bundle's entitlements and options, and
	# notarization rejects the result. Sign each nested executable explicitly, deepest first,
	# or the outer signature seals mis-signed code.
	@set -e; SPK=$(APP_BUNDLE)/Contents/Frameworks/Sparkle.framework/Versions/B; \
	for x in "$$SPK"/XPCServices/*.xpc "$$SPK/Updater.app" "$$SPK/Autoupdate"; do \
	  [ -e "$$x" ] || continue; \
	  echo "  signing $$x"; \
	  codesign --force $(CODESIGN_FLAGS) --sign "$(SIGN_IDENTITY)" "$$x"; \
	done; \
	codesign --force $(CODESIGN_FLAGS) --sign "$(SIGN_IDENTITY)" "$$SPK"
	codesign --force $(CODESIGN_FLAGS) --sign "$(SIGN_IDENTITY)" $(APP_BUNDLE)
	codesign --verify --deep --strict $(APP_BUNDLE)
	@echo "Signed with: $(SIGN_IDENTITY)"

# DMG for first-time downloads (auto-updates travel as .zip via Sparkle).
# Stable, unversioned name: the landing links releases/latest/download/bruma.dmg.
# Built by scripts/make-dmg.sh, not create-dmg: create-dmg 1.3.0 sets the Finder
# window's `statusbar visible`, a property macOS 26 removed, so it aborts with
# -10006 after the build and notarization have already been paid for. See the
# header of that script.
dmg:
	rm -f dist/$(APP_NAME).dmg
	mkdir -p dist
	scripts/make-dmg.sh $(APP_BUNDLE) dist/$(APP_NAME).dmg $(APP_NAME)
	codesign --force $(CODESIGN_FLAGS) --sign "$(SIGN_IDENTITY)" dist/$(APP_NAME).dmg

# ── Notarization ──────────────────────────────────────────────────────────────
# Apple scans the build and issues a ticket Gatekeeper trusts, so a downloaded app opens on
# a double-click: no right-click → Open, no `xattr -dr com.apple.quarantine`. Needs hardened
# runtime + secure timestamp (CODESIGN_FLAGS) and a Developer ID identity.
#
# NOTE: notarization does NOT grant TCC permissions (Accessibility, Full Disk Access, …).
# Those the user always approves by hand.
#
# One Apple account covers the whole vaho family, so all four apps share the same notarytool
# Keychain profile. Created once with:
#   xcrun notarytool store-credentials vaho-notary --apple-id <id> --team-id XZVWF6BXDQ
NOTARY_PROFILE ?= vaho-notary
NOTARIZE_ZIP = .notarize-upload.zip

check-devid:
	@case "$(SIGN_IDENTITY)" in \
	  "Developer ID Application"*) ;; \
	  *) echo "ERROR: notarization requires a Developer ID Application identity."; \
	     echo "       Current SIGN_IDENTITY: $(SIGN_IDENTITY)"; exit 1 ;; \
	esac

# Staple the app BEFORE zipping it for Sparkle or copying it into the dmg: stapling attaches
# the ticket to the bundle on disk, so first launch works with no network.
notarize-app: check-devid
	@test -d $(APP_BUNDLE) || { echo "ERROR: $(APP_BUNDLE) not found — run 'make release' first"; exit 1; }
	rm -f $(NOTARIZE_ZIP)
	ditto -c -k --keepParent $(APP_BUNDLE) $(NOTARIZE_ZIP)
	@echo "Submitting $(APP_BUNDLE) to Apple (queue is usually minutes, can be over an hour)..."
	xcrun notarytool submit $(NOTARIZE_ZIP) --keychain-profile $(NOTARY_PROFILE) --wait
	rm -f $(NOTARIZE_ZIP)
	xcrun stapler staple $(APP_BUNDLE)
	spctl -a -vvv -t exec $(APP_BUNDLE)

# The dmg is its own downloaded file, so Gatekeeper checks it separately from the app inside.
notarize-dmg: check-devid
	@test -f dist/$(APP_NAME).dmg || { echo "ERROR: dist/$(APP_NAME).dmg not found — run 'make dmg' first"; exit 1; }
	xcrun notarytool submit dist/$(APP_NAME).dmg --keychain-profile $(NOTARY_PROFILE) --wait
	xcrun stapler staple dist/$(APP_NAME).dmg
	xcrun stapler validate dist/$(APP_NAME).dmg

run: all
	open $(APP_BUNDLE)

clean:
	swift package clean
	rm -rf $(APP_BUNDLE)
