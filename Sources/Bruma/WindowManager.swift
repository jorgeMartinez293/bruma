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

    init(bridge: NativeBridge, schemeHandler: WidgetSchemeHandler) {
        self.bridge = bridge
        self.schemeHandler = schemeHandler
        rebuild()
        bridge.backdropDelegate = self
        NotificationCenter.default.addObserver(
            self, selector: #selector(rebuild),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
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
