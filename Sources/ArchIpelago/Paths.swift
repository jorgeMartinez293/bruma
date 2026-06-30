import Foundation

/// Central location for the app's on-disk paths.
enum Paths {
    /// ~/Library/Application Support/ArchIpelago
    static let supportDir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory,
                                            in: .userDomainMask)[0]
        return base.appendingPathComponent("ArchIpelago", isDirectory: true)
    }()

    /// Folder watched for widgets. Drop `<name>/<name>.jsx` widgets here.
    static let widgetsDir = supportDir.appendingPathComponent("widgets", isDirectory: true)

    /// Persisted drag positions: { widgetId: { x, y } }.
    static let positionsFile = supportDir.appendingPathComponent("positions.json")

    /// Persisted enabled/disabled widget state: { "disabled": [widgetId, …] }.
    /// File-backed (not UserDefaults) so other apps — e.g. LiquidNotch's theme tool —
    /// can snapshot and restore it alongside positions.json.
    static let statesFile = supportDir.appendingPathComponent("states.json")

    /// Übersicht's widgets dir — used once to seed a test widget on first run.
    static let ubersichtWidgetsDir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory,
                                            in: .userDomainMask)[0]
        return base.appendingPathComponent("Übersicht/widgets", isDirectory: true)
    }()

    static func ensureDirectories() {
        try? FileManager.default.createDirectory(at: widgetsDir,
                                                 withIntermediateDirectories: true)
    }
}
