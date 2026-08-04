import AppKit
import WebKit

/// Owns one desktop window + web host per screen, and rebuilds them when the
/// screen arrangement changes. Fans out edit-mode and reload commands.
final class WindowManager: BackdropDelegate {
    private let bridge: NativeBridge
    private let schemeHandler: WidgetSchemeHandler
    private var windows: [DesktopWindow] = []
    private var hosts: [WebHost] = []
    private var backdrops: [BackdropContainer] = []

    /// The screen arrangement the current windows were built for. Compared on
    /// every screen-parameters notification so a rebuild only happens when the
    /// arrangement really changed — see `screenParametersChanged()`.
    private struct ScreenLayout: Equatable {
        let id: String
        let frame: NSRect
        let scale: CGFloat
    }
    private var layout: [ScreenLayout] = []

    init(bridge: NativeBridge, schemeHandler: WidgetSchemeHandler) {
        self.bridge = bridge
        self.schemeHandler = schemeHandler
        rebuild()
        bridge.backdropDelegate = self
        NotificationCenter.default.addObserver(
            self, selector: #selector(screenParametersChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    private static func currentLayout() -> [ScreenLayout] {
        NSScreen.screens.map {
            ScreenLayout(id: $0.displayID, frame: $0.frame, scale: $0.backingScaleFactor)
        }
    }

    /// `didChangeScreenParametersNotification` fires for far more than display
    /// hot-plugs: an EDR/auto-brightness ramp (HDR content on screen, ambient
    /// light change) re-posts it dozens of times per second, and rebuilding the
    /// windows on each one tore the widgets down and reloaded the whole runtime
    /// continuously — they simply vanished for as long as the ramp lasted.
    /// So only act when the arrangement itself changed, and when the same
    /// displays merely moved or resized, reuse the live webviews.
    @objc private func screenParametersChanged() {
        let current = Self.currentLayout()
        guard current != layout else { return } // EDR / brightness ramp: nothing to do
        if current.map(\.id) == layout.map(\.id) {
            layout = current
            for (window, screen) in zip(windows, NSScreen.screens) {
                window.setFrame(screen.frame, display: true)
            }
            return
        }
        rebuild()
    }

    private(set) var editMode = false

    /// Edit mode = picker drawer open: desktop windows accept clicks so
    /// instances can be dragged and removed; the JS runtime shows the
    /// per-instance remove badges.
    func setEditMode(_ on: Bool) {
        editMode = on
        for w in windows { w.setInteractive(on) }
        for h in hosts { h.setEditMode(on) }
    }

    @objc func rebuild() {
        for w in windows { w.orderOut(nil); w.close() }
        windows.removeAll()
        hosts.removeAll()
        backdrops.removeAll()
        layout = Self.currentLayout()

        for screen in NSScreen.screens {
            let window = DesktopWindow(screen: screen)
            let host = WebHost(frame: window.contentLayoutRect, screenID: screen.displayID,
                               bridge: bridge, schemeHandler: schemeHandler)

            // Native glass sits behind the transparent webview: the web layer
            // draws only widget content; the material comes from AppKit.
            let content = FlippedContentView(frame: window.contentLayoutRect)
            let backdrop = BackdropContainer(frame: content.bounds)
            backdrop.autoresizingMask = [.width, .height]
            host.webView.frame = content.bounds
            content.addSubview(backdrop)
            content.addSubview(host.webView)
            window.contentView = content

            window.orderFront(nil)
            windows.append(window)
            hosts.append(host)
            backdrops.append(backdrop)
        }

        // Screen change while the picker is open: keep the fresh windows editable.
        if editMode { setEditMode(true) }
    }

    // MARK: BackdropDelegate

    func updateBackdrops(for webView: WKWebView?, frames: [BackdropFrame]) {
        guard let webView,
              let index = hosts.firstIndex(where: { $0.webView === webView }),
              index < backdrops.count else { return }
        backdrops[index].update(frames: frames)
    }

    func reloadWidgets() {
        for host in hosts { host.reloadWidgets() }
    }

    /// Push a live grid-snap change to every desktop runtime (no reload needed;
    /// the next drag picks up the new value).
    func setSnapToGrid(_ on: Bool) {
        for h in hosts { h.setSnapToGrid(on) }
    }
}
