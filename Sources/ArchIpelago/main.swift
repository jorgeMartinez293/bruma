import AppKit

@main
struct ArchIpelagoMain {
    static func main() {
        let app = NSApplication.shared
        // Agent app: no Dock icon, no app menu — lives in the menu bar only.
        app.setActivationPolicy(.accessory)
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}
