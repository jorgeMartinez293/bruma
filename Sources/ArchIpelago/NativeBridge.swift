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
///     { action: "log", message }
final class NativeBridge: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    private let store: WidgetStore
    private let positions: PositionStore
    private let shell = ShellRunner()

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
        case "log":
            if let msg = body["message"] { NSLog("[widget] \(msg)") }
        default:
            break
        }
    }
}
