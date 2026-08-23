import AppKit

/// Frame of one widget requesting a native glass backdrop, in CSS pixels
/// (top-left origin, same scale as the webview's points).
struct BackdropFrame {
    let id: String
    let rect: NSRect
    let cornerRadius: CGFloat
}

/// One widget's backdrop: a blurred crop of the desktop wallpaper (see
/// `WallpaperSnapshot`) plus the specular rim native widgets have — a
/// hairline glint brightest at the top-left corner with a dimmer reflection
/// at the bottom-right, fading out at the other two corners.
final class WidgetBackdropView: NSView {
    private let imageLayer = CALayer()
    private let tintLayer = CALayer()
    private let rim: SpecularRimView
    private weak var wallpaper: WallpaperSnapshot?
    private var globalRect: NSRect = .zero

    var cornerRadius: CGFloat {
        didSet {
            imageLayer.cornerRadius = cornerRadius
            tintLayer.cornerRadius = cornerRadius
            rim.cornerRadius = cornerRadius
        }
    }

    init(frame: NSRect, cornerRadius: CGFloat) {
        self.cornerRadius = cornerRadius
        rim = SpecularRimView(frame: NSRect(origin: .zero, size: frame.size))
        rim.cornerRadius = cornerRadius
        super.init(frame: frame)

        wantsLayer = true
        imageLayer.frame = bounds
        imageLayer.cornerCurve = .continuous
        imageLayer.cornerRadius = cornerRadius
        imageLayer.masksToBounds = true
        imageLayer.contentsGravity = .resizeAspectFill
        imageLayer.backgroundColor = NSColor.windowBackgroundColor.withAlphaComponent(0.4).cgColor
        layer?.addSublayer(imageLayer)

        // Native glass/vibrancy materials darken in dark mode and add a
        // faint wash in light mode; a raw wallpaper crop has neither, so it
        // reads too bright next to real system chrome. Reapply it by hand.
        tintLayer.frame = bounds
        tintLayer.cornerCurve = .continuous
        tintLayer.cornerRadius = cornerRadius
        layer?.addSublayer(tintLayer)

        rim.autoresizingMask = [.width, .height]
        addSubview(rim)

        // Soft ambient shadow like native desktop widgets.
        let shadow = NSShadow()
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.25)
        shadow.shadowBlurRadius = 14
        shadow.shadowOffset = NSSize(width: 0, height: -6)
        self.shadow = shadow

        updateTint()
    }

    required init?(coder: NSCoder) { fatalError("unused") }

    override func layout() {
        super.layout()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.frame = bounds
        tintLayer.frame = bounds
        CATransaction.commit()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        updateTint()
    }

    private func updateTint() {
        let isDark = effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
        tintLayer.backgroundColor = isDark
            ? NSColor.black.withAlphaComponent(0.38).cgColor
            : NSColor.white.withAlphaComponent(0.12).cgColor
    }

    /// Positions this backdrop against `wallpaper` and crops/blurs the tile
    /// under `globalRect` (screen coordinates, from `NSWindow.convertToScreen`).
    func configure(wallpaper: WallpaperSnapshot, globalRect: NSRect) {
        self.wallpaper = wallpaper
        self.globalRect = globalRect
        refreshImage()
    }

    /// Re-derives the tile from the wallpaper snapshot's current bitmap —
    /// called after `wallpaper.reload()` picks up a changed desktop picture.
    func refreshImage() {
        guard let wallpaper else { return }
        imageLayer.contents = wallpaper.blurredTile(for: globalRect)
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

/// Container that sits *behind* the webview and hosts one backdrop per
/// widget, each a blurred crop of `wallpaper` (see `WallpaperSnapshot`) —
/// the webview cannot blur what lies behind a transparent window, so this is
/// the layer that fakes native glass.
final class BackdropContainer: NSView {
    private let wallpaper: WallpaperSnapshot
    private var views: [String: WidgetBackdropView] = [:]

    override var isFlipped: Bool { true } // match CSS top-left coordinates

    init(frame: NSRect, wallpaper: WallpaperSnapshot) {
        self.wallpaper = wallpaper
        super.init(frame: frame)
    }

    required init?(coder: NSCoder) { fatalError("unused") }

    func update(frames: [BackdropFrame]) {
        var seen = Set<String>()
        for frame in frames {
            seen.insert(frame.id)
            let view: WidgetBackdropView
            if let existing = views[frame.id] {
                existing.frame = frame.rect
                existing.cornerRadius = frame.cornerRadius
                view = existing
            } else {
                view = WidgetBackdropView(frame: frame.rect, cornerRadius: frame.cornerRadius)
                views[frame.id] = view
                addSubview(view)
            }
            view.configure(wallpaper: wallpaper, globalRect: globalRect(for: frame.rect))
        }
        for (id, view) in views where !seen.contains(id) {
            view.removeFromSuperview()
            views.removeValue(forKey: id)
        }
    }

    /// Re-derives every backdrop's tile after `wallpaper.reload()` — call on
    /// Spaces switches / screen changes, not continuously.
    func refreshWallpaper() {
        wallpaper.reload()
        for view in views.values { view.refreshImage() }
    }

    private func globalRect(for localRect: NSRect) -> NSRect {
        guard let window else { return localRect }
        return window.convertToScreen(convert(localRect, to: nil))
    }

    func clear() { update(frames: []) }
}

/// Flipped content view so webview + backdrops share CSS's top-left origin.
final class FlippedContentView: NSView {
    override var isFlipped: Bool { true }
}
