import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var windowManager: WindowManager!
    private var watcher: WidgetWatcher!
    private var store: WidgetStore!
    private var positions: PositionStore!

    func applicationDidFinishLaunching(_ notification: Notification) {
        Paths.ensureDirectories()
        seedTestWidgetIfEmpty()

        store = WidgetStore(root: Paths.widgetsDir)
        positions = PositionStore(file: Paths.positionsFile)
        let bridge = NativeBridge(store: store, positions: positions)

        guard let runtimeRoot = Bundle.module.url(forResource: "runtime", withExtension: nil) else {
            NSLog("Nubio: runtime bundle missing"); NSApp.terminate(nil); return
        }
        let schemeHandler = WidgetSchemeHandler(runtimeRoot: runtimeRoot, store: store)

        windowManager = WindowManager(bridge: bridge, schemeHandler: schemeHandler)

        // Watch the whole support dir: covers widget edits (hot-reload) AND external
        // overwrites of positions.json / states.json — e.g. when LiquidNotch's theme
        // tool restores a saved layout — re-reading both stores and refreshing the menu.
        watcher = WidgetWatcher(path: Paths.supportDir.path) { [weak self] in
            guard let self else { return }
            self.positions.reload()
            self.store.reload()
            self.windowManager.reloadWidgets()
            self.rebuildMenu()
        }
        watcher.start()

        setupStatusItem()
    }

    // MARK: First-run seed

    private func seedTestWidgetIfEmpty() {
        let fm = FileManager.default
        let existing = (try? fm.contentsOfDirectory(at: Paths.widgetsDir,
                            includingPropertiesForKeys: nil,
                            options: [.skipsHiddenFiles])) ?? []
        guard existing.isEmpty else { return }

        // Seed the Übersicht clock so the project can be verified immediately.
        let src = Paths.ubersichtWidgetsDir.appendingPathComponent("ghostkwebb-cool-clock")
        guard fm.fileExists(atPath: src.path) else { return }
        let dst = Paths.widgetsDir.appendingPathComponent("ghostkwebb-cool-clock")
        try? fm.copyItem(at: src, to: dst)
        NSLog("Nubio: seeded test widget from Übersicht")
    }

    // MARK: Menu bar

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "square.on.square.dashed",
                                   accessibilityDescription: "Nubio")
            button.image?.isTemplate = true
        }
        rebuildMenu()
    }

    private func rebuildMenu() {
        let menu = NSMenu()
        menu.addItem(withTitle: "Recargar widgets", action: #selector(reload), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "Abrir carpeta de widgets", action: #selector(openFolder), keyEquivalent: "").target = self

        menu.addItem(.separator())

        let widgets = store.listAll()
        if widgets.isEmpty {
            let empty = NSMenuItem(title: "No hay widgets", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)
        } else {
            for widget in widgets {
                let item = NSMenuItem(title: widget.id, action: #selector(toggleWidget(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = widget.id
                item.state = store.isEnabled(id: widget.id) ? .on : .off
                menu.addItem(item)
            }
        }

        menu.addItem(.separator())
        menu.addItem(withTitle: "Salir de Nubio", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
    }

    @objc private func reload() {
        windowManager.reloadWidgets()
    }

    @objc private func openFolder() {
        NSWorkspace.shared.open(Paths.widgetsDir)
    }

    @objc private func toggleWidget(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        store.setEnabled(!store.isEnabled(id: id), forId: id)
        windowManager.reloadWidgets()
        rebuildMenu()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
