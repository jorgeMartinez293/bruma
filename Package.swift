// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Bruma",
    platforms: [.macOS(.v13)],
    dependencies: [
        // Sparkle: in-app auto-updates. Ships as a binary XCFramework; the Makefile
        // embeds Sparkle.framework into the .app bundle (swift build alone doesn't).
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.6.0"),
    ],
    targets: [
        .executableTarget(
            name: "Bruma",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            resources: [
                .copy("Resources/runtime")
            ],
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"])
            ]
        )
    ]
)
