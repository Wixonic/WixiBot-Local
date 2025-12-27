const childProcess = require("child_process");
const WebSocket = require("ws");

/**
 * @type {{audio: string[], video: string[]}}
 */
const deviceList = {
	audio: [],
	video: []
};

/** @param {string} name */
const trimName = (name) => name.split("(")[0].replace(/\s\n\t/, " ").trim();

/** @param {import("@wixonic/logger").Logger} logger */
const updateDeviceList = (logger) => {
	return new Promise((resolve) => {
		try {
			const process = childProcess.spawn("ffmpeg", [
				"-f", "avfoundation",
				"-list_devices", "true",
				"-i", ""
			]);

			let output = "";

			process.stderr.on("data", (data) => output += data.toString());
			process.stdout.on("data", (data) => output += data.toString());

			process.on("close", () => {
				deviceList.audio = [];
				deviceList.video = [];
				const devices = output.split("AVFoundation audio devices");

				if (devices[0]) {
					for (const match of devices[0].matchAll(/\.*\] \[(\d+)\] (.+)/g)) deviceList.video[Number(match[1])] = trimName(match[2]);
				}
				if (devices[1]) {
					for (const match of devices[1].matchAll(/\.*\] \[(\d+)\] (.+)/g)) deviceList.audio[Number(match[1])] = trimName(match[2]);
				}

				resolve();
			});

			process.on("error", (e) => {
				logger.error("Failed to list devices:", e);
				resolve();
			});
		} catch (e) {
			logger.error("Failed to list devices:", e);
			resolve();
		}
	});
};

/** @typedef {{spawn: (settings: import("../../types.d.ts").Settings, logger: import("@wixonic/logger").Logger) => childProcess.ChildProcess, process: childProcess.ChildProcess?, active: boolean, binaryOutput?: boolean, name: string}} CaptureProcess */

/**
 * @type {{[name: string]: CaptureProcess}}
 */
const captureProcess = {
	broadcast: {
		active: false,
		name: "Broadcast",
		spawn: () => null,
		process: null
	},
	micbroadcast: {
		active: false,
		binaryOutput: true,
		name: "Mic Broadcast",
		spawn: (settings, logger) => {
			const sox = childProcess.spawn("sox", [
				"-t", "coreaudio", "BlackHole WixiBot",
				"-b", "16",
				"-c", "2",
				"-r", "48000",
				"-t", "raw",
				"-e", "signed-integer",
				"-q",
				"-",
				"vol", "0.5"
			]);

			const ws = new WebSocket("wss://server.wixonic.fr", {
				rejectUnauthorized: false
			});

			ws.on("open", () => {
				logger.info("WebSocket connected");
				ws.send(Buffer.from([0x01, ...Buffer.from(settings.secrets.wixkey)]));

				sox.stdout.on("data", (chunk) => {
					if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
				});
			});

			ws.on("error", (e) => {
				logger.warn("WebSocket error:", e);
				sox.kill();
			});

			ws.on("close", (code, reason) => {
				logger.warn("WebSocket closed:", code, reason);
				sox.kill();
			});

			sox.on("close", () => {
				if (ws.readyState === WebSocket.OPEN) ws.close();
			});

			return sox;
		},
		process: null
	}
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {CaptureProcess} cp
 * @param {import("../../types.d.ts").Settings} settings
 */
const startProcess = (logger, cp, settings) => {
	const cpLogger = {
		debug: (...args) => logger.debug(`[${cp.name}]`, ...args),
		error: (...args) => logger.error(`[${cp.name}]`, ...args),
		info: (...args) => logger.info(`[${cp.name}]`, ...args),
		warn: (...args) => logger.warn(`[${cp.name}]`, ...args)
	};

	cpLogger.info("Starting");
	cp.process = cp.spawn(settings, cpLogger);

	if (cp.process instanceof childProcess.ChildProcess) {
		cp.process.on("close", () => {
			cpLogger.info("Closed");
			cp.process = null;
		});
		cp.process.on("error", (error) => cpLogger.warn(error));
		cp.process.on("exit", (code, signal) => {
			cpLogger.info("Exited with code", code);
			cp.process = null;
		});
		cp.process.stderr?.on("data", (data) => cpLogger.warn(data.toString().trim()));
		cp.process.stdout?.on("data", (data) => {
			if (!cp.binaryOutput) cpLogger.debug(data.toString().trim());
		});
	}
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {CaptureProcess} cp
 */
const stopProcess = (logger, cp) => {
	const cpLogger = {
		debug: (...args) => logger.debug(`[${cp.name}]`, ...args),
		error: (...args) => logger.error(`[${cp.name}]`, ...args),
		info: (...args) => logger.info(`[${cp.name}]`, ...args),
		warn: (...args) => logger.warn(`[${cp.name}]`, ...args)
	};

	if (!cp.process || cp.process.killed) return;
	cpLogger.info("Stopping");

	cp.process.kill("SIGTERM");

	const killTimeout = setTimeout(() => {
		if (!cp.process.killed) {
			cpLogger.warn(`Did not respond to SIGTERM. Forcing kill with SIGKILL.`);
			cp.process.kill("SIGKILL");
		}
	}, 3000);
	cp.process.once("exit", () => clearTimeout(killTimeout));
};

/**
 * @type {import("../../types.d.ts").HandlerInfo}
 */
const info = {
	path: "/process/",
	handlers: {
		get: (logger, settings, req, res) => {
			const { id } = req.query;

			if (!id || !captureProcess[id]) return res.status(400).json({
				error: "Invalid or missing process ID"
			});

			res.status(200).json({
				id,
				active: captureProcess[id].active
			});
		},
		post: (logger, settings, req, res) => {
			try {
				const { id } = req.query;
				const { status } = JSON.parse(req.body);

				if (!id || !captureProcess[id]) return res.status(400).json({
					error: "Invalid or missing process ID"
				});
				captureProcess[id].active = status;

				res.status(200).json({
					id,
					active: captureProcess[id].active
				});
			} catch (e) {
				logger.warn("[obs/settings]", e);
				res.status(400).json({
					error: "Invalid status value"
				});
			}
		}
	},
	loop: {
		delay: 1 * 1000,
		process: async (logger, settings) => {
			let updated = false;

			for (const cp of Object.values(captureProcess)) {
				if (cp.active && !cp.process) {
					if (!updated) {
						updated = true;
						await updateDeviceList(logger);
					}
					startProcess(logger, cp, settings);

					if (!cp.process && cp.active) {
						logger.warn(`Failed to spawn process for ${cp.name}, disabling.`);
						cp.active = false;
					}
				} else if (!cp.active && cp.process) stopProcess(logger, cp);
			}

			return false;
		}
	}
};

module.exports = info;