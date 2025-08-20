const childProcess = require("child_process");

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
	try {
		const result = childProcess.spawnSync("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
			"-f", "avfoundation",
			"-list_devices", "true",
			"-i", ""
		], { encoding: "utf8", stderr: "pipe" });

		deviceList.audio = [];
		deviceList.video = [];
		const output = (result.stderr || result.stdout).split("AVFoundation audio devices");

		for (const match of output[0].matchAll(/\.*\] \[(\d+)\] (.+)/g)) deviceList.video[Number(match[1])] = trimName(match[2]);
		for (const match of output[1].matchAll(/\.*\] \[(\d+)\] (.+)/g)) deviceList.audio[Number(match[1])] = trimName(match[2]);
	} catch (e) {
		logger.error("Failed to list devices:", e);
	}
};

const defaultInputArgs = [
	"-hide_banner",
	"-loglevel", "repeat+level+warning",
	"-fflags", "nobuffer+genpts",
	"-flags", "low_delay"
];

const h264VideotoolboxArgs = (bitrate = "16M", gop = 30) => ([
	"-c:v", "h264_videotoolbox",
	"-preset", "ultrafast",
	"-realtime", "1",
	"-profile:v", "high",
	"-b:v", bitrate,
	"-g", String(gop),
]);

/** @param {number} port */
const udpInput = (port) => ([
	"-muxdelay", "0.1",
	"-muxpreload", "0.1",
	"-f", "mpegts",
	`udp://10.0.0.1:${port}?buffer_size=65535`
]);

const defaultOutputArgs = [
	"-hide_banner",
	"-loglevel", "repeat+level+warning",
	"-fflags", "nobuffer",
	"-flags", "low_delay",
	"-probesize", "32",
	"-analyzeduration", "50000",
	"-sync", "audio"
];

/** @param {number} port */
const udpOutput = (port) => ([
	"-f", "mpegts",
	`udp://10.0.0.1:${port}?listen=1&fifo_size=8192&overrun_nonfatal=1`
]);

/** @typedef {{spawn: () => childProcess.ChildProcess, process: childProcess.ChildProcess?, active: boolean, name: string}} CaptureProcess */

/**
 * @type {{[name: string]: CaptureProcess}}
 */
const captureProcess = {
	audio: {
		active: false,
		name: "Audio capture",
		spawn: () => {
			const deviceIndex = deviceList.audio.indexOf("BlackHole");
			if (deviceIndex == -1) return null;
			else return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				...defaultInputArgs,

				"-f", "avfoundation",
				"-framerate", "60",
				"-i", `:${deviceIndex}`,

				"-c:a", "aac", "-b:a", "320k", "-ac", "2", "-ar", "48000",

				"-af", "volume=0.5",

				...udpInput(2000)
			]);
		},
		process: null
	},
	screenshare1: {
		active: false,
		name: "Screen capture 1",
		spawn: () => {
			const deviceIndex = deviceList.video.indexOf("Capture screen 0");
			if (deviceIndex == -1) return null;
			else return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				...defaultInputArgs,

				"-f", "avfoundation",
				"-capture_cursor", "1",
				"-framerate", "60", "-video_size", "3024x1964", "-pixel_format", "uyvy422",
				"-i", `${deviceIndex}:`,

				...h264VideotoolboxArgs("16M", 30),
				...udpInput(2001)
			]);
		},
		process: null
	},
	screenshare2: {
		active: false,
		name: "Screen capture 2",
		spawn: () => {
			const deviceIndex = deviceList.video.indexOf("Capture screen 1");
			if (deviceIndex == -1) return null;
			else return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				...defaultInputArgs,

				"-f", "avfoundation",
				"-capture_cursor", "1",
				"-framerate", "60", "-video_size", "3840x2160", "-pixel_format", "uyvy422",
				"-i", `${deviceIndex}:`,

				...h264VideotoolboxArgs("16M", 30),
				...udpInput(2001)
			]);
		},
		process: null
	},
	camera: {
		active: false,
		name: "Camera capture",
		spawn: () => null,
		process: null
	},
	microphone: {
		active: false,
		name: "Microphone streaming",
		spawn: () => childProcess.spawn("ffplay", [
			...defaultOutputArgs,

			"-autoexit",
			"-nodisp",
			"-vn",

			...udpOutput(2003)
		]),
		process: null
	},
	broadcast: {
		active: false,
		name: "Broadcast",
		spawn: () => null,
		process: null
	}
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {CaptureProcess} cp
 */
const startProcess = (logger, cp) => {
	const cpLogger = {
		debug: (...args) => logger.debug(`[${cp.name}]`, ...args),
		error: (...args) => logger.error(`[${cp.name}]`, ...args),
		info: (...args) => logger.info(`[${cp.name}]`, ...args),
		warn: (...args) => logger.warn(`[${cp.name}]`, ...args)
	};

	cpLogger.info("Starting");
	cp.process = cp.spawn();

	if (cp.process instanceof childProcess.ChildProcess) {
		cp.process.on("error", (error) => cpLogger.warn(error));
		cp.process.on("exit", (code, signal) => {
			cpLogger.info("Stopped");
			cp.process = null;
		});
		cp.process.stderr?.on("data", (data) => cpLogger.warn(data.toString().trim()));
		cp.process.stdout?.on("data", (data) => cpLogger.debug(data.toString().trim()));
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
			cpLogger.warn(`Did not respond to SIGTERM.Forcing kill with SIGKILL.`);
			cp.process.kill("SIGKILL");
		}
	}, 3000);
	cp.process.once("exit", () => clearTimeout(killTimeout));
};

/**
 * @type {import("../../types.d.ts").HandlerInfo}
 */
const info = {
	path: "/obs/settings/",
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
		process: (logger, settings) => {
			updateDeviceList(logger);

			for (const cp of Object.values(captureProcess)) {
				if (cp.active && !cp.process) startProcess(logger, cp, settings);
				else if (!cp.active && cp.process) stopProcess(logger, cp);
			}

			return false;
		}
	}
};

module.exports = info;