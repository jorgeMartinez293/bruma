import AppKit

/// Drives a "pull it off the shelf" drag: the picker starts a native drag by
/// posting `beginCardDrag`, and this controller carries a floating ghost image
/// of the card across every window until the mouse is released, then reports the
/// drop point so a new instance can be placed exactly where it landed.
///
/// It must be native because the picker and the desktop are separate windows
/// (and separate WKWebViews) — HTML5 drag-and-drop can't cross that boundary.
/// Global + local event monitors follow the cursor everywhere on screen; the
/// ghost window ignores the mouse so it never intercepts the drop.
final class ShelfDragController {
    /// Reports a completed drop: `x`/`y` are CSS px (top-left origin) in the
    /// target screen's coordinate space, `screen` is that screen's display id.
    var onDrop: ((_ widget: String, _ x: Double, _ y: Double, _ screen: String?) -> Void)?
    /// Fired when the drag ends (dropped or cancelled), so the picker can clear
    /// its "lifted card" styling.
    var onEnd: (() -> Void)?
    /// The current picker panel frame (global coords); a drop landing back on the
    /// shelf is treated as a cancel.
    var pickerFrameProvider: (() -> CGRect)?

    private var ghost: NSWindow?
    private var imageView: NSImageView?
    private var localMonitor: Any?
    private var globalMonitor: Any?
    private var widget = ""
    private var grab = CGPoint.zero      // cursor offset from the card's top-left (CSS px)
    private var ghostSize = CGSize.zero
    private var active = false

    /// Begins carrying `widget`. `image` may be nil at first (the snapshot is
    /// async) — a placeholder chip is shown until `updateImage` swaps it in.
    func begin(widget: String, image: NSImage?, size: CGSize, grab: CGPoint) {
        if active { end() }
        active = true
        self.widget = widget
        self.grab = grab
        self.ghostSize = size

        let win = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                           styleMask: [.borderless], backing: .buffered, defer: false)
        win.isOpaque = false
        win.backgroundColor = .clear
        win.hasShadow = true
        win.level = .screenSaver
        win.ignoresMouseEvents = true
        win.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        win.alphaValue = 0.92

        let iv = NSImageView(frame: NSRect(origin: .zero, size: size))
        iv.imageScaling = .scaleAxesIndependently
        iv.wantsLayer = true
        iv.layer?.cornerCurve = .continuous
        iv.layer?.cornerRadius = 16
        iv.layer?.masksToBounds = true
        iv.image = image ?? Self.placeholder(name: widget, size: size)
        win.contentView = iv
        self.imageView = iv
        self.ghost = win

        position(to: NSEvent.mouseLocation)
        win.orderFront(nil)

        localMonitor = NSEvent.addLocalMonitorForEvents(
            matching: [.leftMouseDragged, .leftMouseUp]) { [weak self] ev in
            self?.handle(ev.type)
            return ev
        }
        globalMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDragged, .leftMouseUp]) { [weak self] ev in
            self?.handle(ev.type)
        }
    }

    /// Swaps the live card snapshot in once it's ready.
    func updateImage(_ image: NSImage?) {
        guard active, let image else { return }
        imageView?.image = image
    }

    private func handle(_ type: NSEvent.EventType) {
        guard active else { return }
        if type == .leftMouseUp {
            finish()
        } else {
            position(to: NSEvent.mouseLocation)
        }
    }

    /// Places the ghost so the grab point stays glued under the cursor. `grab` is
    /// measured from the card's top edge (CSS, down-positive); AppKit origins are
    /// bottom-left, so the top of the ghost sits `grab.y` above the cursor.
    private func position(to mouse: NSPoint) {
        let origin = NSPoint(x: mouse.x - grab.x,
                             y: mouse.y + grab.y - ghostSize.height)
        ghost?.setFrameOrigin(origin)
    }

    private func finish() {
        guard active else { return }
        let mouse = NSEvent.mouseLocation

        // Dropped back on the shelf → cancel.
        if let frame = pickerFrameProvider?(), frame.contains(mouse) {
            end(); return
        }
        let screen = NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) }
            ?? NSScreen.main
        guard let screen else { end(); return }

        // The ghost's top-left in global (bottom-left) coords, mapped into the
        // target screen's CSS space (top-left origin, local to that screen).
        let topLeftY = mouse.y + grab.y
        let originX = mouse.x - grab.x
        let x = Double(originX - screen.frame.minX)
        let y = Double(screen.frame.maxY - topLeftY)
        onDrop?(widget, x, y, screen.displayID)
        end()
    }

    private func end() {
        active = false
        if let m = localMonitor { NSEvent.removeMonitor(m); localMonitor = nil }
        if let m = globalMonitor { NSEvent.removeMonitor(m); globalMonitor = nil }
        ghost?.orderOut(nil)
        ghost = nil
        imageView = nil
        onEnd?()
    }

    /// A rounded chip fallback shown for the instant before the snapshot lands.
    private static func placeholder(name: String, size: CGSize) -> NSImage {
        let img = NSImage(size: size)
        img.lockFocus()
        let rect = NSRect(origin: .zero, size: size)
        let path = NSBezierPath(roundedRect: rect, xRadius: 16, yRadius: 16)
        NSColor(white: 0.12, alpha: 0.85).setFill()
        path.fill()
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        style.lineBreakMode = .byTruncatingTail
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12, weight: .semibold),
            .foregroundColor: NSColor.white.withAlphaComponent(0.9),
            .paragraphStyle: style
        ]
        let textRect = rect.insetBy(dx: 10, dy: (size.height - 18) / 2)
        (name as NSString).draw(in: textRect, withAttributes: attrs)
        img.unlockFocus()
        return img
    }
}
