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

        setFrame(screen.frame, display: true)
    }


}
