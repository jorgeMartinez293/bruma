// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Nubio",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "Nubio",
            resources: [
                .copy("Resources/runtime")
            ],
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"])
            ]
        )
    ]
)
