import WebKit

/// Hosts one transparent WKWebView that loads the widget runtime.
/// One WebHost exists per screen.
final class WebHost {
    let webView: WKWebView

    init(frame: NSRect, bridge: NativeBridge, schemeHandler: WidgetSchemeHandler) {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: WidgetSchemeHandler.scheme)

        let ucc = config.userContentController
        ucc.addScriptMessageHandler(bridge, contentWorld: .page, name: "arch")
        ucc.add(bridge, name: "archNotify")

        // Let widgets reach the network if they want; mirror Übersicht defaults.
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: frame, configuration: config)
        webView.setValue(false, forKey: "drawsBackground") // transparent webview
        webView.autoresizingMask = [.width, .height]
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        load()
    }

    func load() {
        webView.load(URLRequest(url: URL(string: WidgetSchemeHandler.runtimeIndex)!))
    }

    func reloadWidgets() {
        webView.evaluateJavaScript("window.__arch && window.__arch.reloadAll();", completionHandler: nil)
    }

    func setEditMode(_ on: Bool) {
        webView.evaluateJavaScript("window.__arch && window.__arch.setEditMode(\(on));",
                                   completionHandler: nil)
    }

}
