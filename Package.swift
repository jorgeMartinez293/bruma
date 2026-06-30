// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ArchIpelago",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "ArchIpelago",
            resources: [
                .copy("Resources/runtime")
            ],
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"])
            ]
        )
    ]
)
