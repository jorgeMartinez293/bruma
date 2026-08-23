import AppKit

/// Stable-ish identity + primary-display lookup for the connected screens.
extension NSScreen {
    /// The CoreGraphics display id as a string ("NSScreenNumber"). Stable while a
    /// display stays connected; used to bind a widget instance to one monitor.
    var displayID: String {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?
            .stringValue ?? "0"
    }

    /// The macOS primary display — the one whose frame sits at the global origin.
    /// Used as the home for instances that carry no screen binding yet.
    static var primaryID: String {
        (screens.first { $0.frame.origin == .zero } ?? screens.first)?.displayID ?? "0"
    }
}

/// Persists app-level preferences to settings.json next to instances.json.
///
///   syncMonitors == true  → every connected monitor shows the same widgets
///                           (the original behaviour).
///   syncMonitors == false → each monitor has its own independent widget set;
///                           an instance is bound to the screen it was placed on.
///
///   snapToGrid == true  → dragging a widget in edit mode snaps it to a grid.
///   snapToGrid == false → widgets can be placed freely (the original behaviour).
final class SettingsStore {
    private let file: URL

    // Fields are optional so an older settings.json (which only carried
    // syncMonitors) still decodes — a missing key falls back to its default
    // instead of failing the whole decode.
    private struct Payload: Codable {
        var syncMonitors: Bool?
        var snapToGrid: Bool?
        var launchAtLoginPromptShown: Bool?
    }

    /// Default is `true`: monitors mirror each other, matching how Bruma behaved
    /// before per-monitor layouts existed.
    private(set) var syncMonitors: Bool = true

    /// Default is `false`: free placement, matching how Bruma behaved before the
    /// grid-snap toggle existed.
    private(set) var snapToGrid: Bool = false

    /// Whether the one-time "launch at login?" prompt has already been shown.
    private(set) var launchAtLoginPromptShown: Bool = false

    init(file: URL) {
        self.file = file
        if let data = try? Data(contentsOf: file),
           let decoded = try? JSONDecoder().decode(Payload.self, from: data) {
            syncMonitors = decoded.syncMonitors ?? syncMonitors
            snapToGrid = decoded.snapToGrid ?? snapToGrid
            launchAtLoginPromptShown = decoded.launchAtLoginPromptShown ?? launchAtLoginPromptShown
        }
    }

    func setSyncMonitors(_ on: Bool) {
        guard on != syncMonitors else { return }
        syncMonitors = on
        persist()
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
        let payload = Payload(syncMonitors: syncMonitors, snapToGrid: snapToGrid,
                              launchAtLoginPromptShown: launchAtLoginPromptShown)
        guard let data = try? encoder.encode(payload) else { return }
        try? data.write(to: file, options: .atomic)
    }
}
