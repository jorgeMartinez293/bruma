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

    /// Edit mode: while the widget picker is open, the window accepts clicks
    /// (drag / remove instances) and floats just above the Finder desktop-icons
    /// layer so it — not Finder — receives them. Still below normal windows.
    func setInteractive(_ on: Bool) {
        ignoresMouseEvents = !on
        level = on
            ? NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
            : NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)))
    }

}
