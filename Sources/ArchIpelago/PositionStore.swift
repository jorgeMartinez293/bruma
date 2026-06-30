import Foundation

/// Persists per-widget drag positions to positions.json.
final class PositionStore {
    struct Point: Codable { var x: Double; var y: Double }
    private(set) var positions: [String: Point] = [:]
    private let file: URL

    init(file: URL) {
        self.file = file
        load()
    }

    /// Re-reads positions.json. Called when the file is overwritten externally
    /// (e.g. applying a LiquidNotch theme) so widgets reload at the saved spots.
    func reload() { load() }

    private func load() {
        guard let data = try? Data(contentsOf: file),
              let decoded = try? JSONDecoder().decode([String: Point].self, from: data)
        else { return }
        positions = decoded
    }

    func set(id: String, x: Double, y: Double) {
        positions[id] = Point(x: x, y: y)
        save()
    }

    func asDictionary() -> [String: [String: Double]] {
        positions.mapValues { ["x": $0.x, "y": $0.y] }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(positions) else { return }
        try? data.write(to: file, options: .atomic)
    }
}
