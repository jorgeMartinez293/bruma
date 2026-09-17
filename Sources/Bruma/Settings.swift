import AppKit

/// Stable identity + primary-display lookup for the connected screens.
extension NSScreen {
    /// The display's UUID, as a string — the identity a widget instance binds to.
    ///
    /// NOT the CoreGraphics display number ("NSScreenNumber"), which is what this
    /// used to return: that number is handed out per session, so plugging in a
    /// second monitor, unplugging one, or rebooting can renumber the displays. An
    /// instance bound to a number that moved then matched no connected screen and
    /// rendered on none of them — the widgets looked deleted. The UUID belongs to
    /// the physical display and survives all of that.
    var displayID: String {
        guard let cg = cgDisplayID else { return "0" }
        guard let uuid = CGDisplayCreateUUIDFromDisplayID(cg)?.takeRetainedValue() else {
            // No UUID for this display (rare — a virtual or AirPlay screen mid-teardown):
            // the session-local number is still better than collapsing every such screen
            // onto a single id.
            return String(cg)
        }
        return CFUUIDCreateString(nil, uuid) as String
    }

    /// The CoreGraphics display number as a string — the identity bindings were written
    /// with before the UUID switch. Read only to migrate them, see
    /// `InstanceStore.migrateScreenBindings`.
    var legacyDisplayID: String { cgDisplayID.map(String.init) ?? "0" }

    var cgDisplayID: CGDirectDisplayID? {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)
            .map { CGDirectDisplayID($0.uint32Value) }
    }

    /// The macOS primary display — the one whose frame sits at the global origin.
    /// Used as the home for instances that carry no screen binding yet.
    static var primaryID: String {
        (screens.first { $0.frame.origin == .zero } ?? screens.first)?.displayID ?? "0"
    }

    /// Ids of the displays attached right now, so a binding that still resolves can be
    /// told from one that currently points at nothing.
    static var connectedIDs: Set<String> { Set(screens.map(\.displayID)) }
}

/// Persists app-level preferences to settings.json next to instances.json.
///
///   snapToGrid == true  → dragging a widget in edit mode snaps it to a grid.
///   snapToGrid == false → widgets can be placed freely (the original behaviour).
final class SettingsStore {
    private let file: URL

    // Fields are optional so an older settings.json still decodes — a missing
    // key falls back to its default instead of failing the whole decode. Keys
    // that no longer exist (e.g. the removed syncMonitors) are ignored.
    private struct Payload: Codable {
        var snapToGrid: Bool?
        var launchAtLoginPromptShown: Bool?
    }

    /// Default is `false`: free placement, matching how Bruma behaved before the
    /// grid-snap toggle existed.
    private(set) var snapToGrid: Bool = false

    /// Whether the one-time "launch at login?" prompt has already been shown.
    private(set) var launchAtLoginPromptShown: Bool = false

    init(file: URL) {
        self.file = file
        if let data = try? Data(contentsOf: file),
           let decoded = try? JSONDecoder().decode(Payload.self, from: data) {
            snapToGrid = decoded.snapToGrid ?? snapToGrid
            launchAtLoginPromptShown = decoded.launchAtLoginPromptShown ?? launchAtLoginPromptShown
        }
    }

    func setSnapToGrid(_ on: Bool) {
        guard on != snapToGrid else { return }
        snapToGrid = on
        persist()
    }

    func markLaunchAtLoginPromptShown() {
        guard !launchAtLoginPromptShown else { return }
        launchAtLoginPromptShown = true
        persist()
    }

    private func persist() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let payload = Payload(snapToGrid: snapToGrid,
                              launchAtLoginPromptShown: launchAtLoginPromptShown)
        guard let data = try? encoder.encode(payload) else { return }
        try? data.write(to: file, options: .atomic)
    }
}
