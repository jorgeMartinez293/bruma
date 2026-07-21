import AppKit
import WebKit

/// The widget gallery: a glass drawer that slides up from the bottom of the
/// screen (opened from the menu-bar icon) showing a live preview of every
/// available widget preset. Clicking a preview places a new instance on the
/// desktop; while the drawer is open the desktop is in edit mode.
final class PickerPanel: NSPanel {
    static let height: CGFloat = 270

    private let webView: WKWebView
    var onClose: (() -> Void)?

    init(bridge: NativeBridge, schemeHandler: WidgetSchemeHandler) {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: WidgetSchemeHandler.scheme)
        let ucc = config.userContentController
        ucc.addScriptMessageHandler(bridge, contentWorld: .page, name: "arch")
        ucc.add(bridge, name: "archNotify")
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        super.init(contentRect: NSRect(x: 0, y: 0, width: 900, height: Self.height),
                   styleMask: [.borderless, .nonactivatingPanel],
                   backing: .buffered, defer: false)

        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        level = .popUpMenu
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        isReleasedWhenClosed = false
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = false
        animationBehavior = .none // we animate the frame ourselves

        // Native material behind a transparent webview, rounded like a sheet.
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 900, height: Self.height))
        container.wantsLayer = true
        container.layer?.cornerCurve = .continuous
        container.layer?.cornerRadius = 26
        container.layer?.masksToBounds = true

        let material = Self.makeMaterial(frame: container.bounds)
        material.autoresizingMask = [.width, .height]
        webView.frame = container.bounds
        webView.autoresizingMask = [.width, .height]
        container.addSubview(material)
        container.addSubview(webView)
        contentView = container
    }

    private static func makeMaterial(frame: NSRect) -> NSView {
        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView(frame: frame)
            glass.cornerRadius = 26
            return glass
        }
        let effect = NSVisualEffectView(frame: frame)
        effect.blendingMode = .behindWindow
        effect.material = .popover
        effect.state = .active
        return effect
    }

    override var canBecomeKey: Bool { true }

    override func cancelOperation(_ sender: Any?) { onClose?() }

    /// Slides the drawer up from the bottom edge of `screen`.
    func show(on screen: NSScreen) {
        let width = min(screen.visibleFrame.width - 40, 1080)
        let x = screen.frame.midX - width / 2
        let finalFrame = NSRect(x: x, y: screen.visibleFrame.minY + 16,
                                width: width, height: Self.height)
        let startFrame = NSRect(x: x, y: screen.frame.minY - Self.height,
                                width: width, height: Self.height)

        // Reload each open so the gallery reflects the current widgets folder.
        webView.load(URLRequest(url: URL(string: "archw://runtime/picker.html")!))

        setFrame(startFrame, display: false)
        alphaValue = 0
        orderFrontRegardless()
        makeKey()
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.3
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            animator().setFrame(finalFrame, display: true)
            animator().alphaValue = 1
        }
    }

    func hide() {
        guard isVisible else { return }
        let target = frame.offsetBy(dx: 0, dy: -(frame.height + 60))
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeIn)
            animator().setFrame(target, display: true)
            animator().alphaValue = 0
        }, completionHandler: { [weak self] in
            self?.orderOut(nil)
        })
    }
}
