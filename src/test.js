const { spawn } = require("child_process");
const readline = require("readline");
const WebSocket = require("ws");

const url = "ws://server.wixonic.fr:444";

const getAvailableDevices = () => {
	return new Promise((resolve, reject) => {
		const devices = [];
		const listDevices = spawn("sox", ["-V6", "-n", "-t", "coreaudio", "null"]);

		listDevices.stderr.on("data", (data) => {
			for (const line of data.toString().split("\n")) {
				const match = line.match(/sox INFO coreaudio: Found Audio Device "(.*?)"/);
				if (match) devices.push(match[1]);
			}
		});

		listDevices.on("close", () => {
			resolve(devices);
		});

		listDevices.on("error", (err) => {
			reject(err);
		});
	});
};

const startMicProcess = (device) => {
	return spawn("sox", [
		"-t", "coreaudio", device,
		"-b", "16",
		"-c", "2",
		"-r", "48000",
		"-t", "raw",
		"-e", "signed-integer",
		"-",
		"vol", "0.5"
	]);
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

const handleMicCrash = async (device) => {
	try {
		const availableDevices = await getAvailableDevices();
		if (!availableDevices.includes(device)) {
			console.log(`Device ${device} is no longer available. Stopping...`);
			return;
		}

		const micProcess = startMicProcess(device);
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
			});
		}
	} catch (e) {
		console.error("Error while checking devices or restarting sox:", e);
	}
};

getAvailableDevices()
	.then((devices) => {
		console.log(devices.join("\n"));
		console.log("-----");
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		rl.question("Enter input ID: ", (device) => {
			handleMicCrash(device);
			rl.close();
		});
	});
