import AppKit

/// One placed copy of a widget preset on the desktop.
struct WidgetInstance: Codable, Equatable {
    let id: String      // unique instance id ("<widget>-<suffix>")
    let widget: String  // preset id (folder/file name in the widgets dir)
    var x: Double?      // CSS px, top-left origin; nil = widget's own CSS position
    var y: Double?      // point measured at `anchor`, not necessarily the corner
    var screen: String? // display id this instance is bound to; nil = unbound
                        // (shows on every monitor in sync mode, on the primary
                        //  monitor in separate mode)
    var anchor: String? // which point of the widget box `x`/`y` pin down, so the
                        // widget grows away from it instead of pushing it around;
                        // nil = "top-left" (the historical behaviour)

    /// The nine anchors, in reading order (row-major). The runtime derives the
    /// factors from the index: column/2 horizontally, row/2 vertically.
    static let anchors: Set<String> = [
        "top-left", "top", "top-right",
        "left", "center", "right",
        "bottom-left", "bottom", "bottom-right"
    ]
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
                           x: points[widget]?.x, y: points[widget]?.y,
                           screen: nil, anchor: nil)
        }
    }

    // MARK: Mutations

    /// Places a new instance of `widget`. With explicit `x`/`y` (a drag-drop from
    /// the picker), it lands exactly there; otherwise it cascades from the centre
    /// of the main screen so consecutive click-placements don't stack exactly on
    /// top of each other. `screen` binds the instance to one monitor (separate
    /// mode); pass nil in sync mode so it shows on every monitor.
    @discardableResult
    func add(widget: String, screen: String? = nil,
             x: Double? = nil, y: Double? = nil) -> WidgetInstance {
        let px: Double, py: Double
        if let x, let y {
            px = x; py = y
        } else {
            let bounds = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
            let offset = Double(instances.count % 6) * 36
            px = bounds.width / 2 - 120 + offset
            py = bounds.height / 2 - 160 + offset
        }
        let inst = WidgetInstance(id: Self.freshId(for: widget), widget: widget,
                                  x: px, y: py, screen: screen, anchor: nil)
        instances.append(inst)
        persist()
        return inst
    }

    func remove(id: String) {
        instances.removeAll { $0.id == id }
        persist()
    }

    /// Saves a drag. `x`/`y` are measured at the instance's anchor, which is
    /// what the runtime reports when the drag ends.
    func move(id: String, x: Double, y: Double) {
        guard let i = instances.firstIndex(where: { $0.id == id }) else { return }
        instances[i].x = x
        instances[i].y = y
        persist()
    }

    /// Changes which point of the widget box its saved position pins down.
    /// The runtime re-measures the point for the new anchor and sends it along,
    /// so switching anchors never moves the widget — it only changes where it
    /// grows from when its content resizes.
    func setAnchor(id: String, anchor: String, x: Double?, y: Double?) {
        guard WidgetInstance.anchors.contains(anchor),
              let i = instances.firstIndex(where: { $0.id == id }) else { return }
        instances[i].anchor = anchor
        if let x { instances[i].x = x }
        if let y { instances[i].y = y }
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

    /// JSON-bridge-friendly shape for the JS runtime, filtered for one monitor.
    ///
    /// - `screen`: the requesting host's display id (nil for the picker, which
    ///   wants the whole list).
    /// - `syncMonitors`: when true every monitor shows every instance. When
    ///   false a host shows only instances bound to its own screen; instances
    ///   with no binding fall to the primary display so nothing vanishes.
    func asArray(forScreen screen: String? = nil, syncMonitors: Bool = true) -> [[String: Any]] {
        let visible: [WidgetInstance]
        if syncMonitors || screen == nil {
            visible = instances
        } else {
            let primary = NSScreen.primaryID
            visible = instances.filter { inst in
                if let s = inst.screen { return s == screen }
                return screen == primary
            }
        }
        return visible.map { inst in
            var d: [String: Any] = ["id": inst.id, "widget": inst.widget]
            if let x = inst.x { d["x"] = x }
            if let y = inst.y { d["y"] = y }
            if let s = inst.screen { d["screen"] = s }
            if let a = inst.anchor { d["anchor"] = a }
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
