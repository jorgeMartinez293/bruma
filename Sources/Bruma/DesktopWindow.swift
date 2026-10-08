import AppKit

/// A borderless, fully transparent window pinned at the desktop level
/// (behind icons), present on every Space. This is what makes widgets
/// render directly on the wallpaper with no background.
final class DesktopWindow: NSWindow {

    init(screen: NSScreen) {
        super.init(
            contentRect: screen.frame,
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        // Desktop level: below normal windows and the Finder icons layer.
        level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))

        // True transparency — the imperative requirement.
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        titlebarAppearsTransparent = true
        isReleasedWhenClosed = false

        // Visible on all Spaces, never cycled/managed like a normal window.
        collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenNone]

        ignoresMouseEvents = true
        acceptsMouseMovedEvents = true // lets the local monitor see the cursor leave an interactive widget

        setFrame(screen.frame, display: true)
    }

    /// Edit mode: while the widget picker is open, the window accepts clicks
    /// (drag / remove instances) and floats just above the Finder desktop-icons
    /// layer so it — not Finder — receives them. Still below normal windows.
    func setInteractive(_ on: Bool) {
        editInteractive = on
        applyInteraction()
    }

    /// Boxes (top-left origin, webview points) of the widgets that opted in to
    /// mouse input with `export const interactive = true`.
    var interactiveRects: [CGRect] = [] {
        didSet { updatePointer(at: NSEvent.mouseLocation) }
    }

    private var editInteractive = false
    private var pointerOverWidget = false

    /// Outside edit mode the window stays click-through, except while the cursor
    /// is over an interactive widget: then it takes mouse input (clicks, scroll)
    /// and sits above the desktop-icons layer so Finder does not swallow it.
    func updatePointer(at screenPoint: NSPoint) {
        let local = CGPoint(x: screenPoint.x - frame.minX, y: frame.maxY - screenPoint.y)
        let over = interactiveRects.contains { $0.contains(local) }
        guard over != pointerOverWidget else { return }
        pointerOverWidget = over
        applyInteraction()
    }

    private func applyInteraction() {
        let live = editInteractive || pointerOverWidget
        ignoresMouseEvents = !live
        level = live
            ? NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
            : NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
    }

}
