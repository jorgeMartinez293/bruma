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

    /// On-disk shape of `states.json`.
    private struct State: Codable { var disabled: [String] }

    /// Disabled-widget ids, cached in memory and mirrored to `statesFile`.
    private var disabledIDs: Set<String>

    init(root: URL, statesFile: URL = Paths.statesFile) {
        self.root = root
        self.statesFile = statesFile
        self.disabledIDs = Self.loadDisabled(from: statesFile, legacyKey: legacyDefaultsKey)
        // Make sure a freshly-migrated (or first-run) set lands on disk so the file
        // exists for LiquidNotch to capture even before any toggle.
        persist()
    }

    func isEnabled(id: String) -> Bool { !disabledIDs.contains(id) }

    func setEnabled(_ enabled: Bool, forId id: String) {
        if enabled { disabledIDs.remove(id) } else { disabledIDs.insert(id) }
        persist()
    }

    /// Re-reads `statesFile` from disk. Called when the file is overwritten
    /// externally (e.g. applying a LiquidNotch theme) so the menu/widgets reflect it.
    func reload() {
        disabledIDs = Self.loadDisabled(from: statesFile, legacyKey: legacyDefaultsKey)
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(State(disabled: Array(disabledIDs).sorted())) else { return }
        try? data.write(to: statesFile, options: .atomic)
    }

    /// Loads disabled ids from `statesFile`, falling back to (and migrating) the
    /// legacy UserDefaults key on first run after the file-backed switch.
    private static func loadDisabled(from file: URL, legacyKey: String) -> Set<String> {
        if let data = try? Data(contentsOf: file),
           let state = try? JSONDecoder().decode(State.self, from: data) {
            return Set(state.disabled)
        }
        // Migrate any pre-existing UserDefaults value (one-time).
        return Set(UserDefaults.standard.stringArray(forKey: legacyKey) ?? [])
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
