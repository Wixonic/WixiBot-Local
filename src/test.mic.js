const { spawn } = require("child_process");
const WebSocket = require("ws");

const url = "wss://localhost:999/";

const startMicProcess = () => {
	const sox = spawn("sox", [
		"-t", "coreaudio", "Wave Link Stream",
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
			rejectUnauthorized: false // config.rejectUnauthorized
		});

		ws.on("open", () => {
			console.log("WebSocket connected");

			ws.once("message", (message) => {
				if (message[0] == 0x00) {
					console.log("Server answered");

					micProcess.stdout.on("data", (chunk) => {
						if (ws.readyState == WebSocket.OPEN) ws.send(chunk);
					});
				} else console.log("Server didn't answered");
			});

			ws.send(Buffer.from([0x01]));
		});

		ws.on("error", (e) => {
			console.log("WebSocket error:", e);
			ws.close();
		});

		ws.on("close", () => {
			console.log("WebSocket closed, attempting to reconnect...");
			micProcess.kill();
			setTimeout(connect, 1000);
		});
	};

	connect();
	return ws;
};

const handleMicCrash = async () => {
	try {
		const micProcess = startMicProcess();
		const ws = connectWebSocket(micProcess);

		micProcess.stderr.on("data", (e) => console.error("sox error:", e.toString()));

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