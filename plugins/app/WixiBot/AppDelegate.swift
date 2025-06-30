import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
	var statusItem: NSStatusItem!
    var backgroundTaskProcess: Process?
    var backgroundTaskPID: Int32?

	func applicationDidFinishLaunching(_ notification: Notification) {
		statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

		if let button = statusItem.button {
			button.image = NSImage(systemSymbolName: "terminal.fill", accessibilityDescription: "Launcher")
		}

		let menu = NSMenu()

		audioMenuItem = NSMenuItem(title: "Audio", action: #selector(toggleAudio(_:)), keyEquivalent: "a")
		audioMenuItem.state = audioEnabled ? .on : .off
		audioMenuItem.target = self
		menu.addItem(audioMenuItem)

        screenMenuItem = NSMenuItem(title: "Screenshare", action: #selector(toggleScreen(_:)), keyEquivalent: "s")
        screenMenuItem.state = screenEnabled ? .on : .off
        screenMenuItem.target = self
        menu.addItem(screenMenuItem)

        cameraMenuItem = NSMenuItem(title: "Camera", action: #selector(toggleCamera(_:)), keyEquivalent: "c")
        cameraMenuItem.state = cameraEnabled ? .on : .off
        cameraMenuItem.target = self
        menu.addItem(cameraMenuItem)

		menu.addItem(NSMenuItem(title: "Quit", action: #selector(terminate), keyEquivalent: "q"))
		statusItem.menu = menu

		runZshScript()
	}

    @objc func toggleAudio(_ sender: NSMenuItem) {
		audioEnabled.toggle()
		audioMenuItem.state = audioEnabled ? .on : .off
		sendToggleRequest(id: "audio", status: audioEnabled)
	}

    @objc func toggleScreen(_ sender: NSMenuItem) {
        screenEnabled.toggle()
        screenMenuItem.state = screenEnabled ? .on : .off
        sendToggleRequest(id: "screenshare", status: screenEnabled)
    }

    @objc func toggleCamera(_ sender: NSMenuItem) {
        cameraEnabled.toggle()
        cameraMenuItem.state = cameraEnabled ? .on : .off
        sendToggleRequest(id: "camera", status: cameraEnabled)
    }

    func sendToggleRequest(id: String, status: Bool) {
        guard let url = URL(string: "http://localhost:1000/obs/settings/?id=\(id)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Bool] = ["status": status]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Error sending toggle request for \(id):", error)
            } else {
                print("Sent toggle request for \(id) with status: \(status)")
            }
        }
        task.resume()
    }

	@objc func terminate() {
        if let task = backgroundTaskProcess {
            task.terminate()
            print("Terminated npm process with PID: \(task.processIdentifier)")
        } else if let pid = backgroundTaskPID {
            let killTask = Process()
            killTask.executableURL = URL(fileURLWithPath: "/bin/kill")
            killTask.arguments = ["-9", String(pid)]
            do {
                try killTask.run()
                killTask.waitUntilExit()
                print("Killed background process with PID: \(pid)")
            } catch {
                print("Failed to terminate background process:", error)
            }
        }
        NSApp.terminate(nil)
	}

	func runZshScript() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/npm")
        task.arguments = ["run", "start"]
        task.currentDirectoryURL = URL(fileURLWithPath: "/Users/\(NSUserName())/Documents/GitHub/WixiBot-Local/src")
        var currentEnv = ProcessInfo.processInfo.environment
        let customPaths = "/usr/local/ffmpeg-4.1/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin:/Library/Apple/usr/bin"
        if let userPath = currentEnv["PATH"] {
            currentEnv["PATH"] = userPath + ":" + customPaths
        }
        task.environment = currentEnv
        let logURL = URL(fileURLWithPath: "/Users/\(NSUserName())/WixiBot/logs/local.log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil, attributes: nil)
        if let fileHandle = try? FileHandle(forWritingTo: logURL) {
            task.standardOutput = fileHandle
            task.standardError = fileHandle
        }
        do {
            try task.run()
            backgroundTaskPID = task.processIdentifier
            backgroundTaskProcess = task
            print("Started npm run start with PID: \(task.processIdentifier)")
        } catch {
            print("Failed to run npm:", error)
        }
    }

	func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
		return false
	}
}
