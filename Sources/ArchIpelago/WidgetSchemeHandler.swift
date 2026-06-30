import WebKit
import UniformTypeIdentifiers

/// Serves the runtime bundle and per-widget assets over a custom scheme,
/// so relative `url(...)` references inside a widget's CSS resolve correctly
/// without a local HTTP server.
///
/// URL shapes:
///   archw://runtime/<path>        -> bundled Resources/runtime/<path>
///   archw://widget/<id>/<path>    -> <widgetDir>/<path>
final class WidgetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "archw"
    static let runtimeIndex = "archw://runtime/index.html"

    private let runtimeRoot: URL
    private let store: WidgetStore

    init(runtimeRoot: URL, store: WidgetStore) {
        self.runtimeRoot = runtimeRoot
        self.store = store
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, let fileURL = resolve(url) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        guard let data = try? Data(contentsOf: fileURL) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType(for: fileURL),
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store"
            ]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func resolve(_ url: URL) -> URL? {
        guard let host = url.host else { return nil }
        // url.path is percent-decoded and starts with "/"
        let path = url.path
        switch host {
        case "runtime":
            let rel = path.hasPrefix("/") ? String(path.dropFirst()) : path
            return runtimeRoot.appendingPathComponent(rel)
        case "widget":
            // path = /<id>/<file...>
            var comps = path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
            guard !comps.isEmpty else { return nil }
            let id = comps.removeFirst()
            guard let dir = store.directory(forId: id) else { return nil }
            return dir.appendingPathComponent(comps.joined(separator: "/"))
        default:
            return nil
        }
    }

    private func mimeType(for url: URL) -> String {
        if let type = UTType(filenameExtension: url.pathExtension),
           let mime = type.preferredMIMEType {
            return mime
        }
        switch url.pathExtension.lowercased() {
        case "js": return "application/javascript"
        case "otf": return "font/otf"
        case "ttf": return "font/ttf"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}
