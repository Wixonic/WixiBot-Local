import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
	var statusItem: NSStatusItem!

	func applicationDidFinishLaunching(_ notification: Notification) {
		statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
		if let button = statusItem.button {
			button.image = NSImage(systemSymbolName: "terminal.fill", accessibilityDescription: "Launcher")
		}

		let menu = NSMenu()
		menu.addItem(NSMenuItem(title: "Quitter", action: #selector(terminate), keyEquivalent: "q"))
		statusItem.menu = menu

		runZshScript()
	}

	@objc func terminate() {
		NSApp.terminate(nil)
	}

	func runZshScript() {
		guard let scriptPath = Bundle.main.path(forResource: "script", ofType: "sh") else {
			print("Script not found in app bundle")
			return
		}

		let fileManager = FileManager.default
        do {
			let attributes = try fileManager.attributesOfItem(atPath: scriptPath)
            if let posixPermissions = attributes[.posixPermissions] as? NSNumber {
                if posixPermissions.intValue & 0o100 == 0 {
                    let newPermissions = posixPermissions.intValue | 0o100
                    try fileManager.setAttributes([.posixPermissions: newPermissions], ofItemAtPath: scriptPath)
                }
            }
        } catch {
            print("Failed to adjust script permissions:", error)
        }

        print("Running script at path: \(scriptPath)")

		let task = Process()
		task.executableURL = URL(fileURLWithPath: "/bin/zsh")
		task.arguments = [scriptPath]
		task.currentDirectoryURL = URL(fileURLWithPath: "/Users/\(NSUserName())")

		let pipe = Pipe()
		task.standardOutput = pipe
		task.standardError = pipe

		do {
			try task.run()
		} catch {
			print("Failed to run script:", error)
		}
		
		pipe.fileHandleForReading.readabilityHandler = { fileHandle in
            let data = fileHandle.availableData
            if let output = String(data: data, encoding: .utf8), !output.isEmpty {
                print(output.trimmingCharacters(in: .newlines))
            }
        }
	}

	func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
		return false
	}
}
