import Foundation

/// Central location for the app's on-disk paths.
enum Paths {
    /// ~/Library/Application Support/Bruma
    ///
    /// The app was previously named Nubio (and before that, ArchIpelago). On first
    /// access, if the Bruma dir doesn't exist yet but one of the legacy dirs does,
    /// the legacy dir is moved into place so widgets, positions and states
    /// survive the rename.
    static let supportDir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory,
                                            in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Bruma", isDirectory: true)
        migrateLegacyDirIfNeeded(to: dir, base: base)
        return dir
    }()

    /// Folder watched for widgets. Drop `<name>/<name>.jsx` widgets here.
    static let widgetsDir = supportDir.appendingPathComponent("widgets", isDirectory: true)

    /// Persisted drag positions: { widgetId: { x, y } }.
    static let positionsFile = supportDir.appendingPathComponent("positions.json")

    /// Persisted widget allowlist: { "enabled": [widgetId, …] } — unlisted = off.
    /// File-backed (not UserDefaults) so other apps — e.g. vaho's themes mode —
    /// can snapshot and restore it alongside positions.json.
    static let statesFile = supportDir.appendingPathComponent("states.json")

    /// Übersicht's widgets dir — used once to seed a test widget on first run.
    static let ubersichtWidgetsDir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory,
                                            in: .userDomainMask)[0]
        return base.appendingPathComponent("Übersicht/widgets", isDirectory: true)
    }()

    /// One-time move of a legacy support dir ("Nubio", or the older "ArchIpelago")
    /// into the new "Bruma" location. Prefers "Nubio" (the more recent name) when
    /// both exist. No-op once Bruma exists.
    private static func migrateLegacyDirIfNeeded(to dir: URL, base: URL) {
        let fm = FileManager.default
        guard !fm.fileExists(atPath: dir.path) else { return }
        for legacy in ["Nubio", "ArchIpelago"] {
            let old = base.appendingPathComponent(legacy, isDirectory: true)
            if fm.fileExists(atPath: old.path) {
                try? fm.moveItem(at: old, to: dir)
                return
            }
        }
    }

    static func ensureDirectories() {
        try? FileManager.default.createDirectory(at: widgetsDir,
                                                 withIntermediateDirectories: true)
    }
}
