const { spawn } = require("child_process");
const WebSocket = require("ws");

const secrets = require("./secrets.js");

const url = "wss://server.wixonic.fr";

const startMicProcess = () => {
	const sox = spawn("sox", [
		"-t", "coreaudio", "BlackHole Discord Sharing",
		"-b", "16",
		"-c", "2",
		"-r", "48000",
		"-t", "raw",
		"-e", "signed-integer",
		"-q",
		"-",
		"vol", "0.5"
	]);
	return sox;
};

const connectWebSocket = (micProcess) => {
	/**
	 * @type {import("ws").WebSocket?}
	 */
	let ws = null;

	const connect = () => {
		console.log("Connecting WebSocket...");

		ws = new WebSocket(url, {
			rejectUnauthorized: true // config.rejectUnauthorized
		});

		ws.on("open", () => {
			console.log("WebSocket connected");

			ws.once("message", (message) => {
				console.log("First message received:", message.toString("hex"));

				if (message[0] == 0x00) {
					console.log("Server answered");

					micProcess.stderr.on("data", (e) => console.error("sox error:", e.toString()));
					micProcess.stdout.on("data", (chunk) => {
						if (ws.readyState == WebSocket.OPEN) ws.send(chunk);
						else {
							ws.close(0x00);
							connectWebSocket(micProcess);
						}
					});
				} else console.log("Server didn't answer as expected");
			});

			ws.send(Buffer.from([0x01, ...Buffer.from(secrets.wixkey)]));
		});

		ws.on("error", (e) => {
			console.log("WebSocket error event:", e);
			ws.close();
		});

		ws.on("close", (code, reason) => {
			console.log("WebSocket closed, code:", code, "reason:", reason);
			micProcess.kill();
			setTimeout(connect, 1000);
		});

		ws.on("unexpected-response", () => console.log("Unexpected response"));
		ws.on("upgrade", () => console.log("Upgrade"));
	};

	connect();
	return ws;
};

const handleMicCrash = async () => {
	try {
		const micProcess = startMicProcess();
		const ws = connectWebSocket(micProcess);

		micProcess.on("close", (code, signal) => {
			console.log(`sox process exited with code ${code} and signal ${signal}`);
			if (code == 0) process.exit();
			else setTimeout(() => handleMicCrash(device), 1000);
		});

		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "uncaughtException", "unhandledRejection", "exit"]) {
			process.on(signal, () => {
				if (ws.readyState === WebSocket.OPEN) ws.close(0);
				micProcess.kill();
				process.exit();
			});
		}
	} catch (e) {
		console.error("Error while checking devices or restarting sox:", e);
	}
};

handleMicCrash();