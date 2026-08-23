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
    private var settings: SettingsStore!
    private var picker: PickerPanel?
    private var bridge: NativeBridge!
    private var schemeHandler: WidgetSchemeHandler!
    private let dragController = ShelfDragController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        Paths.ensureDirectories()
        seedTestWidgetIfEmpty()

        store = WidgetStore(root: Paths.widgetsDir)
        instances = InstanceStore(file: Paths.instancesFile, widgetStore: store)
        settings = SettingsStore(file: Paths.settingsFile)
        bridge = NativeBridge(store: store, instances: instances, settings: settings)

        guard let runtimeRoot = Bundle.module.url(forResource: "runtime", withExtension: nil) else {
            NSLog("Bruma: runtime bundle missing"); NSApp.terminate(nil); return
        }
        schemeHandler = WidgetSchemeHandler(runtimeRoot: runtimeRoot, store: store)

        windowManager = WindowManager(bridge: bridge, schemeHandler: schemeHandler)

        bridge.onInstancesChanged = { [weak self] in self?.windowManager.reloadWidgets() }
        bridge.onSyncMonitorsChanged = { [weak self] in self?.windowManager.reloadWidgets() }
        bridge.onSnapToGridChanged = { [weak self] on in self?.windowManager.setSnapToGrid(on) }
        bridge.onClosePicker = { [weak self] in self?.closePicker() }
        bridge.editModeProvider = { [weak self] in self?.windowManager.editMode ?? false }
        bridge.onBeginCardDrag = { [weak self] widget, rect, grabX, grabY in
            self?.beginCardDrag(widget: widget, rect: rect, grabX: grabX, grabY: grabY)
        }

        // Drag a card off the shelf → place the new instance exactly where it's
        // dropped. Bind to the drop screen in separate mode; leave unbound (shows
        // everywhere) in sync mode, matching click-placement.
        dragController.pickerFrameProvider = { [weak self] in self?.picker?.frame ?? .zero }
        dragController.onEnd = { [weak self] in self?.picker?.resetDrag() }
        dragController.onDrop = { [weak self] widget, x, y, screen in
            guard let self else { return }
            let bind = self.settings.syncMonitors ? nil : screen
            self.instances.add(widget: widget, screen: bind, x: x, y: y)
            self.windowManager.reloadWidgets()
        }

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
        promptLaunchAtLoginIfNeeded()
    }

    // MARK: Launch at login

    /// First-run only: ask whether bruma should open automatically at login.
    private func promptLaunchAtLoginIfNeeded() {
        guard !settings.launchAtLoginPromptShown else { return }
        settings.markLaunchAtLoginPromptShown()

        let alert = NSAlert()
        alert.messageText = "Open bruma at login?"
        alert.informativeText = "bruma can start automatically every time you log in to this Mac."
        alert.addButton(withTitle: "Open at Login")
        alert.addButton(withTitle: "Not Now")
        NSApp.activate(ignoringOtherApps: true)
        let response = alert.runModal()
        LaunchAtLogin.setEnabled(response == .alertFirstButtonReturn)
        rebuildMenu()
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
        menu.addItem(withTitle: "Edit Widgets…", action: #selector(togglePicker), keyEquivalent: "e").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Reload Widgets", action: #selector(reload), keyEquivalent: "r").target = self
        menu.addItem(withTitle: "Open Widgets Folder", action: #selector(openFolder), keyEquivalent: "").target = self

        menu.addItem(.separator())
        let loginItem = NSMenuItem(title: "Open bruma at Login",
                                   action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        loginItem.target = self
        loginItem.state = LaunchAtLogin.isEnabled ? .on : .off
        menu.addItem(loginItem)

        menu.addItem(.separator())
        let update = NSMenuItem(title: "Check for Updates…",
                                action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)),
                                keyEquivalent: "")
        update.target = updaterController
        menu.addItem(update)
        menu.addItem(withTitle: "Quit bruma", action: #selector(quit), keyEquivalent: "q").target = self
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
        // Instances placed from the picker bind to the monitor it opens on
        // (used only in separate mode).
        bridge.pickerScreenID = screen.displayID
        windowManager.setEditMode(true)
        picker?.show(on: screen)
    }

    private func closePicker() {
        picker?.hide()
        windowManager.setEditMode(false)
    }

    /// Starts a native drag ghost for a card pulled off the shelf. The ghost
    /// appears instantly with a placeholder, then swaps in a live snapshot of the
    /// card once WebKit renders it.
    private func beginCardDrag(widget: String, rect: CGRect, grabX: Double, grabY: Double) {
        dragController.begin(widget: widget, image: nil, size: rect.size,
                             grab: CGPoint(x: grabX, y: grabY))
        picker?.snapshot(cssRect: rect) { [weak self] image in
            self?.dragController.updateImage(image)
        }
    }

    @objc private func reload() {
        windowManager.reloadWidgets()
    }

    @objc private func openFolder() {
        NSWorkspace.shared.open(Paths.widgetsDir)
    }

    @objc private func toggleLaunchAtLogin() {
        LaunchAtLogin.setEnabled(!LaunchAtLogin.isEnabled)
        rebuildMenu()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
