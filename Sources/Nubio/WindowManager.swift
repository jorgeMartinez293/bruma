import AppKit

/// Owns one desktop window + web host per screen, and rebuilds them when the
/// screen arrangement changes. Fans out edit-mode and reload commands.
final class WindowManager {
    private let bridge: NativeBridge
    private let schemeHandler: WidgetSchemeHandler
    private var windows: [DesktopWindow] = []
    private var hosts: [WebHost] = []

    init(bridge: NativeBridge, schemeHandler: WidgetSchemeHandler) {
        self.bridge = bridge
        self.schemeHandler = schemeHandler
        rebuild()
        NotificationCenter.default.addObserver(
            self, selector: #selector(rebuild),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    @objc func rebuild() {
        for w in windows { w.orderOut(nil); w.close() }
        windows.removeAll()
        hosts.removeAll()

        for screen in NSScreen.screens {
            let window = DesktopWindow(screen: screen)
            let host = WebHost(frame: window.contentLayoutRect, bridge: bridge,
                               schemeHandler: schemeHandler)
            window.contentView = host.webView
            window.orderFront(nil)
            windows.append(window)
            hosts.append(host)
        }
    }

    func reloadWidgets() {
        for host in hosts { host.reloadWidgets() }
    }
}
