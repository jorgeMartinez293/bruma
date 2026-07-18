import Foundation

/// A discovered widget: its id (folder/file name), JSX source, and base directory
/// (used as the shell `cwd` and the root for relative asset URLs).
struct WidgetItem {
    let id: String
    let source: String
    let dir: URL
}

/// Scans the widgets directory for Übersicht-style widgets.
///
/// Supported layouts (matching Übersicht):
///  - `widgets/<name>/<name>.jsx`  (or any single `*.jsx` inside the folder)
///  - `widgets/<name>.jsx`         (loose file; dir = widgets root)
final class WidgetStore {
    let root: URL

    /// Where enabled/disabled state is persisted. File-backed so external tools
    /// (LiquidNotch themes) can snapshot and restore it.
    private let statesFile: URL
    private let legacyDefaultsKey = "disabledWidgetIDs"

    /// On-disk shape of `states.json`: an allowlist. A widget not listed is OFF.
    /// This (rather than the old `disabled` denylist) is what makes vaho themes
    /// exact snapshots — a widget installed after a theme was captured can't leak
    /// into it, because it isn't in the theme's `enabled` list.
    private struct State: Codable { var enabled: [String] }

    /// Pre-allowlist shape (`{"disabled": [...]}`) still found in old vaho theme
    /// payloads; read-only, migrated on load.
    private struct LegacyState: Codable { var disabled: [String] }

    /// Enabled-widget ids, cached in memory and mirrored to `statesFile`.
    private var enabledIDs: Set<String>

    init(root: URL, statesFile: URL = Paths.statesFile) {
        self.root = root
        self.statesFile = statesFile
        self.enabledIDs = []
        self.enabledIDs = loadEnabled()
        // Make sure a freshly-migrated (or first-run) set lands on disk so the file
        // exists for LiquidNotch to capture even before any toggle. Also converts a
        // legacy denylist file to the allowlist format on first launch.
        persist()
    }

    func isEnabled(id: String) -> Bool { enabledIDs.contains(id) }

    func setEnabled(_ enabled: Bool, forId id: String) {
        if enabled { enabledIDs.insert(id) } else { enabledIDs.remove(id) }
        persist()
    }

    /// Re-reads `statesFile` from disk. Called when the file is overwritten
    /// externally (e.g. applying a LiquidNotch theme) so the menu/widgets reflect it.
    /// Deliberately does NOT persist: the dir watcher triggers this, and writing
    /// back from here would re-trigger the watcher in a loop.
    func reload() {
        enabledIDs = loadEnabled()
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(State(enabled: Array(enabledIDs).sorted())) else { return }
        try? data.write(to: statesFile, options: .atomic)
    }

    /// Loads enabled ids from `statesFile`. Falls back to the legacy denylist
    /// shape (old builds / old theme payloads) and, before that, the legacy
    /// UserDefaults key — both migrated as "every scanned widget not disabled".
    private func loadEnabled() -> Set<String> {
        if let data = try? Data(contentsOf: statesFile) {
            if let state = try? JSONDecoder().decode(State.self, from: data) {
                return Set(state.enabled)
            }
            if let legacy = try? JSONDecoder().decode(LegacyState.self, from: data) {
                return Set(scan().map(\.id)).subtracting(legacy.disabled)
            }
        }
        // Migrate any pre-existing UserDefaults value (one-time).
        let disabled = UserDefaults.standard.stringArray(forKey: legacyDefaultsKey) ?? []
        return Set(scan().map(\.id)).subtracting(disabled)
    }

    /// Resolve a widget id back to its base directory (for the shell bridge).
    func directory(forId id: String) -> URL? {
        for w in listAll() where w.id == id { return w.dir }
        return nil
    }

    /// All discovered widgets regardless of enabled state.
    func listAll() -> [WidgetItem] {
        scan()
    }

    /// Only enabled widgets — used by NativeBridge to feed the JS runtime.
    func list() -> [WidgetItem] {
        scan().filter { isEnabled(id: $0.id) }
    }

    private func scan() -> [WidgetItem] {
        let fm = FileManager.default
        guard let entries = try? fm.contentsOfDirectory(at: root,
                  includingPropertiesForKeys: [.isDirectoryKey],
                  options: [.skipsHiddenFiles]) else { return [] }

        var items: [WidgetItem] = []
        for entry in entries.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            let isDir = (try? entry.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            if isDir {
                if let jsx = jsxFile(inFolder: entry),
                   let src = try? String(contentsOf: jsx, encoding: .utf8) {
                    items.append(WidgetItem(id: entry.lastPathComponent, source: src, dir: entry))
                }
            } else if entry.pathExtension == "jsx" {
                if let src = try? String(contentsOf: entry, encoding: .utf8) {
                    let id = entry.deletingPathExtension().lastPathComponent
                    items.append(WidgetItem(id: id, source: src, dir: root))
                }
            }
        }
        return items
    }

    /// Prefer `<folder>.jsx`, else the first `*.jsx` in the folder.
    private func jsxFile(inFolder folder: URL) -> URL? {
        let fm = FileManager.default
        let preferred = folder.appendingPathComponent(folder.lastPathComponent + ".jsx")
        if fm.fileExists(atPath: preferred.path) { return preferred }
        let files = (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
        return files.first { $0.pathExtension == "jsx" }
    }
}
