import AppKit
import Sparkle

final class AppDelegate: NSObject, NSApplicationDelegate {
    /// Sparkle auto-updates: checks the appcast on the bruma-releases repo's gh-pages.
    private let updaterController = SPUStandardUpdaterController(startingUpdater: true,
                                                                 updaterDelegate: nil,
                                                                 userDriverDelegate: nil)
    private var statusItem: NSStatusItem!
    private var windowManager: WindowManager!
    private var watcher: WidgetWatcher!
    private var store: WidgetStore!
    private var instances: InstanceStore!
    private var picker: PickerPanel?
    private var bridge: NativeBridge!
    private var schemeHandler: WidgetSchemeHandler!

    func applicationDidFinishLaunching(_ notification: Notification) {
        Paths.ensureDirectories()
        seedTestWidgetIfEmpty()

        store = WidgetStore(root: Paths.widgetsDir)
        instances = InstanceStore(file: Paths.instancesFile, widgetStore: store)
        bridge = NativeBridge(store: store, instances: instances)

        guard let runtimeRoot = Bundle.module.url(forResource: "runtime", withExtension: nil) else {
            NSLog("Bruma: runtime bundle missing"); NSApp.terminate(nil); return
        }
        schemeHandler = WidgetSchemeHandler(runtimeRoot: runtimeRoot, store: store)

        windowManager = WindowManager(bridge: bridge, schemeHandler: schemeHandler)

        bridge.onInstancesChanged = { [weak self] in self?.windowManager.reloadWidgets() }
        bridge.onClosePicker = { [weak self] in self?.closePicker() }
        bridge.editModeProvider = { [weak self] in self?.windowManager.editMode ?? false }

        // Watch the whole support dir: widget edits (hot-reload) and external
        // overwrites of instances.json (e.g. hand-edited or theme tools) refresh
        // the desktop. Our own instance saves round-trip through the watcher too,
        // so reloadIfChangedExternally() filters them out — otherwise every drag
        // would remount all widgets.
        watcher = WidgetWatcher(path: Paths.supportDir.path) { [weak self] paths in
            guard let self else { return }
            let instancesChanged = self.instances.reloadIfChangedExternally()
            let widgetsTouched = paths.contains { $0.contains("/widgets/") }
            if instancesChanged || widgetsTouched {
                self.store.reload()
                self.windowManager.reloadWidgets()
            }
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
        NSLog("Bruma: seeded test widget from Übersicht")
    }

    // MARK: Menu bar

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "square.on.square.dashed",
                                   accessibilityDescription: "bruma")
            button.image?.isTemplate = true
        }
        rebuildMenu()
    }

    private func rebuildMenu() {
        let menu = NSMenu()
        menu.addItem(withTitle: "Editar widgets…", action: #selector(togglePicker), keyEquivalent: "e").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Recargar widgets", action: #selector(reload), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "Abrir carpeta de widgets", action: #selector(openFolder), keyEquivalent: "").target = self

        menu.addItem(.separator())
        let update = NSMenuItem(title: "Buscar actualizaciones…",
                                action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)),
                                keyEquivalent: "")
        update.target = updaterController
        menu.addItem(update)
        menu.addItem(withTitle: "Salir de bruma", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
    }

    // MARK: Picker drawer

    @objc private func togglePicker() {
        if let picker, picker.isVisible {
            closePicker()
        } else {
            openPicker()
        }
    }

    private func openPicker() {
        if picker == nil {
            let panel = PickerPanel(bridge: bridge, schemeHandler: schemeHandler)
            panel.onClose = { [weak self] in self?.closePicker() }
            picker = panel
        }
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) }
            ?? NSScreen.main ?? NSScreen.screens[0]
        windowManager.setEditMode(true)
        picker?.show(on: screen)
    }

    private func closePicker() {
        picker?.hide()
        windowManager.setEditMode(false)
    }

    @objc private func reload() {
        windowManager.reloadWidgets()
    }

    @objc private func openFolder() {
        NSWorkspace.shared.open(Paths.widgetsDir)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
