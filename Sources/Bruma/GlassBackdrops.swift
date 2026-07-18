import AppKit

/// Frame of one widget requesting a native glass backdrop, in CSS pixels
/// (top-left origin, same scale as the webview's points).
struct BackdropFrame {
    let id: String
    let rect: NSRect
    let cornerRadius: CGFloat
}

/// One widget's backdrop: the glass material plus the specular rim native
/// widgets have — a hairline glint brightest at the top-left corner with a
/// dimmer reflection at the bottom-right, fading out at the other two corners.
final class WidgetBackdropView: NSView {
    private let material: NSView
    private let rim: SpecularRimView

    var cornerRadius: CGFloat {
        didSet {
            Self.applyCornerRadius(cornerRadius, to: material)
            rim.cornerRadius = cornerRadius
        }
    }

    init(frame: NSRect, cornerRadius: CGFloat) {
        self.cornerRadius = cornerRadius
        material = Self.makeMaterialView(frame: NSRect(origin: .zero, size: frame.size),
                                         cornerRadius: cornerRadius)
        rim = SpecularRimView(frame: NSRect(origin: .zero, size: frame.size))
        rim.cornerRadius = cornerRadius
        super.init(frame: frame)

        material.autoresizingMask = [.width, .height]
        rim.autoresizingMask = [.width, .height]
        addSubview(material)
        addSubview(rim)

        // Soft ambient shadow like native desktop widgets.
        let shadow = NSShadow()
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.25)
        shadow.shadowBlurRadius = 14
        shadow.shadowOffset = NSSize(width: 0, height: -6)
        self.shadow = shadow
    }

    required init?(coder: NSCoder) { fatalError("unused") }

    // MARK: material construction

    private static func makeMaterialView(frame: NSRect, cornerRadius: CGFloat) -> NSView {
        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView(frame: frame)
            glass.cornerRadius = cornerRadius
            return glass
        }
        let effect = NSVisualEffectView(frame: frame)
        effect.blendingMode = .behindWindow
        effect.material = .popover
        effect.state = .active
        effect.wantsLayer = true
        effect.layer?.cornerCurve = .continuous
        effect.layer?.cornerRadius = cornerRadius
        effect.layer?.masksToBounds = true
        return effect
    }

    private static func applyCornerRadius(_ radius: CGFloat, to view: NSView) {
        if #available(macOS 26.0, *), let glass = view as? NSGlassEffectView {
            glass.cornerRadius = radius
        } else {
            view.layer?.cornerRadius = radius
        }
    }
}

/// The rim itself: a 1px rounded-rect stroke whose opacity follows a diagonal
/// gradient — white glint at the top-left, softer echo at the bottom-right,
/// nothing at the top-right / bottom-left corners. This is how light reads on
/// real Liquid Glass edges.
private final class SpecularRimView: NSView {
    var cornerRadius: CGFloat = 0 { didSet { needsDisplay = true } }

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }
        let lineWidth: CGFloat = 1.0
        let inset = lineWidth / 2
        let rect = bounds.insetBy(dx: inset, dy: inset)
        guard rect.width > 0, rect.height > 0 else { return }
        let radius = max(0, cornerRadius - inset)

        let path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
        let stroked = path.copy(strokingWithWidth: lineWidth, lineCap: .round,
                                lineJoin: .round, miterLimit: 10)
        ctx.addPath(stroked)
        ctx.clip()

        // Diagonal from the top-left corner (bright) to the bottom-right
        // (dim echo), crossing zero in the middle so the other two corners
        // stay dark. View is not flipped: top-left = (minX, maxY).
        let colors = [
            NSColor.white.withAlphaComponent(0.85).cgColor,
            NSColor.white.withAlphaComponent(0.0).cgColor,
            NSColor.white.withAlphaComponent(0.0).cgColor,
            NSColor.white.withAlphaComponent(0.45).cgColor,
        ] as CFArray
        let locations: [CGFloat] = [0.0, 0.42, 0.58, 1.0]
        guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                        colors: colors, locations: locations) else { return }
        ctx.drawLinearGradient(
            gradient,
            start: CGPoint(x: bounds.minX, y: bounds.maxY),
            end: CGPoint(x: bounds.maxX, y: bounds.minY),
            options: [])
    }
}

/// Container that sits *behind* the webview and hosts one native backdrop
/// per widget. On macOS 26+ the material is real Liquid Glass
/// (NSGlassEffectView); earlier systems fall back to NSVisualEffectView,
/// which still samples the wallpaper behind the window. Either way the
/// material tracks the system appearance (light/dark) automatically — that
/// is the whole point: the webview cannot blur what lies behind a
/// transparent window, only native views can.
final class BackdropContainer: NSView {
    private var views: [String: WidgetBackdropView] = [:]

    override var isFlipped: Bool { true } // match CSS top-left coordinates

    func update(frames: [BackdropFrame]) {
        var seen = Set<String>()
        for frame in frames {
            seen.insert(frame.id)
            if let existing = views[frame.id] {
                existing.frame = frame.rect
                existing.cornerRadius = frame.cornerRadius
            } else {
                let view = WidgetBackdropView(frame: frame.rect,
                                              cornerRadius: frame.cornerRadius)
                views[frame.id] = view
                addSubview(view)
            }
        }
        for (id, view) in views where !seen.contains(id) {
            view.removeFromSuperview()
            views.removeValue(forKey: id)
        }
    }

    func clear() { update(frames: []) }
}

/// Flipped content view so webview + backdrops share CSS's top-left origin.
final class FlippedContentView: NSView {
    override var isFlipped: Bool { true }
}
