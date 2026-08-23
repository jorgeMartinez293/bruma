import AppKit
import CoreImage
import ImageIO

/// One screen's desktop picture, decoded and aspect-fill-scaled to exactly
/// match how macOS displays it (`NSWorkspaceDesktopImageScalingKey` reports
/// `scaleProportionallyUpOrDown` with clipping — the default "Fill Screen"
/// mode), cached as a single pixel-aligned bitmap. Widget backdrops crop and
/// blur small tiles out of this instead of asking WindowServer to sample the
/// live desktop behind the window — which cannot resolve during a Spaces
/// swipe, since two desktops are compositing at once and the widget window
/// spans both (see git history on GlassBackdrops.swift for how this was
/// diagnosed). A cached bitmap has nothing to resolve, so it can't flash
/// opaque; it costs a wallpaper-change lag instead, refreshed by whoever
/// calls `reload()`.
final class WallpaperSnapshot {
    private let screen: NSScreen
    private let ciContext = CIContext()
    private var displayedImage: CGImage?
    private var lastURL: URL?
    private var lastFrame: NSRect = .zero

    init(screen: NSScreen) {
        self.screen = screen
        reload()
    }

    /// Re-reads the desktop picture URL and re-renders the cached bitmap if
    /// the wallpaper or the screen's frame changed. Cheap no-op otherwise.
    func reload() {
        guard let url = NSWorkspace.shared.desktopImageURL(for: screen) else {
            displayedImage = nil
            lastURL = nil
            return
        }
        guard url != lastURL || screen.frame != lastFrame else { return }
        lastURL = url
        lastFrame = screen.frame

        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            displayedImage = nil
            return
        }

        let scale = screen.backingScaleFactor
        let targetSize = CGSize(width: (screen.frame.width * scale).rounded(),
                                height: (screen.frame.height * scale).rounded())
        displayedImage = Self.render(image, aspectFilling: targetSize)
    }

    /// A blurred crop matching `screenRect` (global screen coordinates,
    /// bottom-left origin — the same space `NSWindow.convertToScreen` uses).
    func blurredTile(for screenRect: NSRect, radius: CGFloat = 26) -> CGImage? {
        guard let displayedImage else { return nil }
        let scale = screen.backingScaleFactor
        let pixelRadius = radius * scale

        // screenRect -> points relative to this screen, top-left origin.
        let local = screenRect.offsetBy(dx: -screen.frame.minX, dy: -screen.frame.minY)
        let topLeft = CGRect(x: local.minX, y: screen.frame.height - local.maxY,
                             width: local.width, height: local.height)
        let padded = topLeft.insetBy(dx: -radius, dy: -radius)

        let pixelRect = CGRect(x: padded.minX * scale, y: padded.minY * scale,
                               width: padded.width * scale, height: padded.height * scale)
            .intersection(CGRect(x: 0, y: 0, width: displayedImage.width, height: displayedImage.height))
        guard !pixelRect.isEmpty, let tile = displayedImage.cropping(to: pixelRect) else { return nil }

        let ci = CIImage(cgImage: tile).clampedToExtent()
            .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: pixelRadius])
        let targetExtent = CIImage(cgImage: tile).extent.insetBy(dx: pixelRadius, dy: pixelRadius)
        guard targetExtent.width > 0, targetExtent.height > 0 else { return nil }
        return ciContext.createCGImage(ci, from: targetExtent)
    }

    private static func render(_ image: CGImage, aspectFilling targetSize: CGSize) -> CGImage? {
        let srcSize = CGSize(width: image.width, height: image.height)
        guard srcSize.width > 0, srcSize.height > 0 else { return nil }
        let fillScale = max(targetSize.width / srcSize.width, targetSize.height / srcSize.height)
        let drawnSize = CGSize(width: srcSize.width * fillScale, height: srcSize.height * fillScale)
        let origin = CGPoint(x: (targetSize.width - drawnSize.width) / 2,
                             y: (targetSize.height - drawnSize.height) / 2)

        guard let ctx = CGContext(data: nil,
                                  width: Int(targetSize.width), height: Int(targetSize.height),
                                  bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.draw(image, in: CGRect(origin: origin, size: drawnSize))
        return ctx.makeImage()
    }
}
