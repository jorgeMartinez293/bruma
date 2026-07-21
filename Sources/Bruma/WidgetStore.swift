import Foundation

/// A discovered widget preset: its id (folder/file name), JSX source, and base
/// directory (used as the shell `cwd` and the root for relative asset URLs).
struct WidgetItem {
    let id: String
    let source: String
    let dir: URL
}

/// Scans the widgets directory for Übersicht-style widget presets.
///
/// Supported layouts (matching Übersicht):
///  - `widgets/<name>/<name>.jsx`  (or any single `*.jsx` inside the folder)
///  - `widgets/<name>.jsx`         (loose file; dir = widgets root)
///
/// Presets carry no on/off state anymore: placement is a list of instances
/// owned by `InstanceStore` (the old states.json allowlist is only read once,
/// as a migration source).
final class WidgetStore {
    let root: URL

    init(root: URL) {
        self.root = root
    }

    /// Kept as a hook for the dir watcher; scanning is stateless today.
    func reload() {}

    /// Resolve a widget id back to its base directory (for the shell bridge).
    func directory(forId id: String) -> URL? {
        for w in listAll() where w.id == id { return w.dir }
        return nil
    }

    /// All discovered widget presets.
    func listAll() -> [WidgetItem] {
        scan()
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
