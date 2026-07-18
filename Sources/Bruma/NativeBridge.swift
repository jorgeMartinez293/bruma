import WebKit

/// JS <-> native bridge.
///
/// Reply channel  "arch"        — async request/response:
///     { action: "listWidgets" }                 -> [{ id, source }]
///     { action: "getPositions" }                -> { id: { x, y } }
///     { action: "shell", id, command }          -> { output, error }
///
/// Notify channel "archNotify"  — fire-and-forget:
///     { action: "savePosition", id, x, y }
///     { action: "backdrops", frames: [{ id, x, y, w, h, r }] }
///     { action: "log", message }
protocol BackdropDelegate: AnyObject {
    func updateBackdrops(for webView: WKWebView?, frames: [BackdropFrame])
}

final class NativeBridge: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    private let store: WidgetStore
    private let positions: PositionStore
    private let shell = ShellRunner()
    weak var backdropDelegate: BackdropDelegate?

    init(store: WidgetStore, positions: PositionStore) {
        self.store = store
        self.positions = positions
    }

    // MARK: Reply channel ("arch")
    func userContentController(_ controller: WKUserContentController,
                              didReceive message: WKScriptMessage,
                              replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            replyHandler(nil, "bad message"); return
        }
        switch action {
        case "listWidgets":
            let widgets = store.list().map { ["id": $0.id, "source": $0.source] }
            replyHandler(widgets, nil)

        case "getPositions":
            replyHandler(positions.asDictionary(), nil)

        case "shell":
            guard let id = body["id"] as? String,
                  let command = body["command"] as? String else {
                replyHandler(nil, "shell: missing id/command"); return
            }
            let cwd = store.directory(forId: id) ?? store.root
            shell.run(command: command, cwd: cwd) { output, error in
                DispatchQueue.main.async {
                    replyHandler(["output": output, "error": error], nil)
                }
            }

        default:
            replyHandler(nil, "unknown action: \(action)")
        }
    }

    // MARK: Notify channel ("archNotify")
    func userContentController(_ controller: WKUserContentController,
                              didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "savePosition":
            if let id = body["id"] as? String,
               let x = (body["x"] as? NSNumber)?.doubleValue,
               let y = (body["y"] as? NSNumber)?.doubleValue {
                positions.set(id: id, x: x, y: y)
            }
        case "backdrops":
            let frames = ((body["frames"] as? [[String: Any]]) ?? []).compactMap { f -> BackdropFrame? in
                guard let id = f["id"] as? String,
                      let x = (f["x"] as? NSNumber)?.doubleValue,
                      let y = (f["y"] as? NSNumber)?.doubleValue,
                      let w = (f["w"] as? NSNumber)?.doubleValue,
                      let h = (f["h"] as? NSNumber)?.doubleValue else { return nil }
                let r = (f["r"] as? NSNumber)?.doubleValue ?? 0
                return BackdropFrame(id: id, rect: NSRect(x: x, y: y, width: w, height: h),
                                     cornerRadius: r)
            }
            backdropDelegate?.updateBackdrops(for: message.webView, frames: frames)

        case "log":
            if let msg = body["message"] { NSLog("[widget] \(msg)") }
        default:
            break
        }
    }
}
