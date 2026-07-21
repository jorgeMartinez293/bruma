import WebKit

/// JS <-> native bridge.
///
/// Reply channel  "arch"        — async request/response:
///     { action: "listWidgets" }                 -> [{ id, source }]   (all presets)
///     { action: "listInstances", screen? }      -> [{ id, widget, x?, y?, screen? }]
///     { action: "addInstance", widget }         -> { id, widget, x, y }
///     { action: "shell", id, command }          -> { output, error }  (id = preset id)
///     { action: "getSyncMonitors" }             -> Bool
///     { action: "getSnapToGrid" }               -> Bool
///
/// Notify channel "archNotify"  — fire-and-forget:
///     { action: "moveInstance", id, x, y }
///     { action: "removeInstance", id }
///     { action: "beginCardDrag", widget, rect: {x,y,w,h}, grabX, grabY }
///     { action: "setSyncMonitors", value }
///     { action: "setSnapToGrid", value }
///     { action: "closePicker" }
///     { action: "backdrops", frames: [{ id, x, y, w, h, r }] }
///     { action: "log", message }
protocol BackdropDelegate: AnyObject {
    func updateBackdrops(for webView: WKWebView?, frames: [BackdropFrame])
}

final class NativeBridge: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    private let store: WidgetStore
    private let instances: InstanceStore
    private let settings: SettingsStore
    private let shell = ShellRunner()
    weak var backdropDelegate: BackdropDelegate?

    /// Fired after the instance set changes from the JS side (add/remove), so
    /// the app can refresh every desktop webview.
    var onInstancesChanged: (() -> Void)?
    /// Fired when the picker page asks to be dismissed (✕ button / Escape).
    var onClosePicker: (() -> Void)?
    /// Fired when the monitor sync mode is toggled from the picker, so the app
    /// can re-filter every desktop webview.
    var onSyncMonitorsChanged: (() -> Void)?
    /// Fired when grid-snap is toggled from the picker, so the app can push the
    /// new value to every live desktop runtime.
    var onSnapToGridChanged: ((Bool) -> Void)?
    /// Fired when a card is dragged off the picker shelf. Carries the widget id,
    /// the card's rect (picker viewport CSS px) and the cursor's grab offset
    /// within it, so the app can start a native drag ghost and place the instance
    /// where it's dropped.
    var onBeginCardDrag: ((_ widget: String, _ rect: CGRect,
                           _ grabX: Double, _ grabY: Double) -> Void)?
    /// Lets a freshly-(re)loaded runtime page ask whether edit mode is on
    /// (a screen rebuild can happen while the picker is open).
    var editModeProvider: (() -> Bool)?

    /// The display id the picker is currently shown on. New instances placed
    /// from the picker bind to this screen while in separate (non-sync) mode.
    var pickerScreenID: String?

    init(store: WidgetStore, instances: InstanceStore, settings: SettingsStore) {
        self.store = store
        self.instances = instances
        self.settings = settings
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
            // The desktop host injects its own display id; the picker omits it
            // and gets the full list.
            let screen = body["screen"] as? String
            replyHandler(instances.asArray(forScreen: screen,
                                           syncMonitors: settings.syncMonitors), nil)

        case "getEditMode":
            replyHandler(editModeProvider?() ?? false, nil)

        case "getSyncMonitors":
            replyHandler(settings.syncMonitors, nil)

        case "getSnapToGrid":
            replyHandler(settings.snapToGrid, nil)

        case "addInstance":
            guard let widget = body["widget"] as? String else {
                replyHandler(nil, "addInstance: missing widget"); return
            }
            // In separate mode, bind the new instance to the monitor the picker
            // is on; in sync mode leave it unbound so it mirrors everywhere.
            let target = settings.syncMonitors ? nil : pickerScreenID
            let inst = instances.add(widget: widget, screen: target)
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
        case "setSyncMonitors":
            if let value = body["value"] as? Bool {
                settings.setSyncMonitors(value)
                onSyncMonitorsChanged?()
            }
        case "setSnapToGrid":
            if let value = body["value"] as? Bool {
                settings.setSnapToGrid(value)
                onSnapToGridChanged?(value)
            }
        case "beginCardDrag":
            guard let widget = body["widget"] as? String,
                  let rect = body["rect"] as? [String: Any],
                  let x = (rect["x"] as? NSNumber)?.doubleValue,
                  let y = (rect["y"] as? NSNumber)?.doubleValue,
                  let w = (rect["w"] as? NSNumber)?.doubleValue,
                  let h = (rect["h"] as? NSNumber)?.doubleValue else { return }
            let grabX = (body["grabX"] as? NSNumber)?.doubleValue ?? 0
            let grabY = (body["grabY"] as? NSNumber)?.doubleValue ?? 0
            onBeginCardDrag?(widget, CGRect(x: x, y: y, width: w, height: h), grabX, grabY)

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
