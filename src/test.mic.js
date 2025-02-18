const { spawn } = require("child_process");
const WebSocket = require("ws");

const url = "ws://server.wixonic.fr:444";

const startMicProcess = () => {
	const sox = spawn("sox", [
		"-t", "coreaudio", "BlackHole 2ch",
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
	let ws = new WebSocket(url);

	const connect = () => {
		console.log("Reconnecting WebSocket...");
		ws = new WebSocket(url);

		ws.on("open", () => {
			console.log("WebSocket connected");
			micProcess.stdout.on("data", (chunk) => {
				if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
			});
		});

		ws.on("message", (message) => {
			console.log("Received message from server:", message);
		});

		ws.on("close", () => {
			console.log("WebSocket closed, attempting to reconnect...");
			micProcess.kill();
			setTimeout(connect, 1000);
		});

		ws.on("error", (err) => {
			console.log("WebSocket error:", err);
			ws.close();
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