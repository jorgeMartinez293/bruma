import Foundation

/// Runs a widget `command` exactly like Übersicht does: spawn a login `bash`
/// with the widget folder as cwd and pipe the command in via stdin.
final class ShellRunner {
    private let queue = DispatchQueue(label: "bruma.shell", attributes: .concurrent)

    func run(command: String, cwd: URL, completion: @escaping (String, String) -> Void) {
        queue.async {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/bash")
            process.arguments = ["-l"]
            process.currentDirectoryURL = cwd

            let inPipe = Pipe()
            let outPipe = Pipe()
            let errPipe = Pipe()
            process.standardInput = inPipe
            process.standardOutput = outPipe
            process.standardError = errPipe

            do {
                try process.run()
            } catch {
                completion("", "spawn failed: \(error.localizedDescription)")
                return
            }

            inPipe.fileHandleForWriting.write(Data(command.utf8))
            try? inPipe.fileHandleForWriting.close()

            let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
            let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()

            let output = String(data: outData, encoding: .utf8) ?? ""
            let error = String(data: errData, encoding: .utf8) ?? ""
            completion(output, error)
        }
    }
}
