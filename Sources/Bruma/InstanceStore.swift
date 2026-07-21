import AppKit

/// One placed copy of a widget preset on the desktop.
struct WidgetInstance: Codable, Equatable {
    let id: String      // unique instance id ("<widget>-<suffix>")
    let widget: String  // preset id (folder/file name in the widgets dir)
    var x: Double?      // CSS px, top-left origin; nil = widget's own CSS position
    var y: Double?
}

/// Persists placed widget instances to instances.json.
///
/// This replaces the old model (states.json allowlist + positions.json) where a
/// widget was a singleton that could only be toggled on or off. Widgets are now
/// presets: any number of instances of the same preset can be placed, each with
/// its own position. On first run after the update, the legacy files are
/// migrated: every enabled widget becomes one instance at its saved position.
final class InstanceStore {
    private(set) var instances: [WidgetInstance] = []
    private let file: URL

    /// Snapshot of the bytes this process last wrote, so the dir watcher can
    /// tell our own saves apart from external edits (and skip a reload loop).
    private var lastWritten: Data?

    init(file: URL, widgetStore: WidgetStore,
         legacyStates: URL = Paths.statesFile,
         legacyPositions: URL = Paths.positionsFile) {
        self.file = file
        if let data = try? Data(contentsOf: file),
           let decoded = try? JSONDecoder().decode([WidgetInstance].self, from: data) {
            instances = decoded
            lastWritten = data
        } else {
            migrate(widgetStore: widgetStore, states: legacyStates, positions: legacyPositions)
            persist()
        }
    }

    // MARK: Legacy migration

    private struct LegacyState: Codable { var enabled: [String] }
    private struct LegacyPoint: Codable { var x: Double; var y: Double }

    private func migrate(widgetStore: WidgetStore, states: URL, positions: URL) {
        var enabled: [String] = []
        if let data = try? Data(contentsOf: states),
           let state = try? JSONDecoder().decode(LegacyState.self, from: data) {
            enabled = state.enabled
        } else {
            enabled = widgetStore.listAll().map(\.id)
        }
        var points: [String: LegacyPoint] = [:]
        if let data = try? Data(contentsOf: positions),
           let decoded = try? JSONDecoder().decode([String: LegacyPoint].self, from: data) {
            points = decoded
        }
        instances = enabled.sorted().map { widget in
            WidgetInstance(id: Self.freshId(for: widget), widget: widget,
                           x: points[widget]?.x, y: points[widget]?.y)
        }
    }

    // MARK: Mutations

    /// Places a new instance of `widget`, cascading from the centre of the main
    /// screen so consecutive placements don't stack exactly on top of each other.
    @discardableResult
    func add(widget: String) -> WidgetInstance {
        let screen = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let offset = Double(instances.count % 6) * 36
        let inst = WidgetInstance(id: Self.freshId(for: widget), widget: widget,
                                  x: screen.width / 2 - 120 + offset,
                                  y: screen.height / 2 - 160 + offset)
        instances.append(inst)
        persist()
        return inst
    }

    func remove(id: String) {
        instances.removeAll { $0.id == id }
        persist()
    }

    func move(id: String, x: Double, y: Double) {
        guard let i = instances.firstIndex(where: { $0.id == id }) else { return }
        instances[i].x = x
        instances[i].y = y
        persist()
    }

    /// Re-reads instances.json if it was changed by someone other than this
    /// process. Returns true when the in-memory set actually changed (callers
    /// should then reload the desktop webviews).
    func reloadIfChangedExternally() -> Bool {
        guard let data = try? Data(contentsOf: file), data != lastWritten,
              let decoded = try? JSONDecoder().decode([WidgetInstance].self, from: data)
        else { return false }
        lastWritten = data
        guard decoded != instances else { return false }
        instances = decoded
        return true
    }

    /// JSON-bridge-friendly shape for the JS runtime.
    func asArray() -> [[String: Any]] {
        instances.map { inst in
            var d: [String: Any] = ["id": inst.id, "widget": inst.widget]
            if let x = inst.x { d["x"] = x }
            if let y = inst.y { d["y"] = y }
            return d
        }
    }

    private func persist() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(instances) else { return }
        lastWritten = data
        try? data.write(to: file, options: .atomic)
    }

    private static func freshId(for widget: String) -> String {
        widget + "-" + UUID().uuidString.prefix(6).lowercased()
    }
}
