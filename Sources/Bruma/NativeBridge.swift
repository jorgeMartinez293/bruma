import WebKit

/// JS <-> native bridge.
///
/// Reply channel  "arch"        — async request/response:
///     { action: "listWidgets" }                 -> [{ id, source }]   (all presets)
///     { action: "listInstances" }               -> [{ id, widget, x?, y? }]
///     { action: "addInstance", widget }         -> { id, widget, x, y }
///     { action: "shell", id, command }          -> { output, error }  (id = preset id)
///
/// Notify channel "archNotify"  — fire-and-forget:
///     { action: "moveInstance", id, x, y }
///     { action: "removeInstance", id }
///     { action: "closePicker" }
///     { action: "backdrops", frames: [{ id, x, y, w, h, r }] }
///     { action: "log", message }
protocol BackdropDelegate: AnyObject {
    func updateBackdrops(for webView: WKWebView?, frames: [BackdropFrame])
}

final class NativeBridge: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    private let store: WidgetStore
    private let instances: InstanceStore
    private let shell = ShellRunner()
    weak var backdropDelegate: BackdropDelegate?

    /// Fired after the instance set changes from the JS side (add/remove), so
    /// the app can refresh every desktop webview.
    var onInstancesChanged: (() -> Void)?
    /// Fired when the picker page asks to be dismissed (✕ button / Escape).
    var onClosePicker: (() -> Void)?
    /// Lets a freshly-(re)loaded runtime page ask whether edit mode is on
    /// (a screen rebuild can happen while the picker is open).
    var editModeProvider: (() -> Bool)?

    init(store: WidgetStore, instances: InstanceStore) {
        self.store = store
        self.instances = instances
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
            let widgets = store.listAll().map { ["id": $0.id, "source": $0.source] }
            replyHandler(widgets, nil)

        case "listInstances":
            replyHandler(instances.asArray(), nil)

        case "getEditMode":
            replyHandler(editModeProvider?() ?? false, nil)

        case "addInstance":
            guard let widget = body["widget"] as? String else {
                replyHandler(nil, "addInstance: missing widget"); return
            }
            let inst = instances.add(widget: widget)
            replyHandler(["id": inst.id, "widget": inst.widget,
                          "x": inst.x ?? 0, "y": inst.y ?? 0], nil)
            onInstancesChanged?()

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
        case "moveInstance":
            if let id = body["id"] as? String,
               let x = (body["x"] as? NSNumber)?.doubleValue,
               let y = (body["y"] as? NSNumber)?.doubleValue {
                instances.move(id: id, x: x, y: y)
            }
        case "removeInstance":
            if let id = body["id"] as? String {
                instances.remove(id: id)
                onInstancesChanged?()
            }
        case "closePicker":
            onClosePicker?()

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
