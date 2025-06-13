const childProcess = require("child_process");

/**
 * @type {{audio: string[], video: string[]}}
 */
const deviceList = {
	audio: [],
	video: []
};

const trimName = (name) => name.split("(")[0].replace(/\s\n\t/, " ").trim();

const updateDeviceList = () => {
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
};

/**
 * @type {{[name: string]: {spawn: (logger: import("@wixonic/logger").Logger, config: import("../types.d.ts").Config) => childProcess.ChildProcess, process: childProcess.ChildProcess?, active: boolean, name: string}}}
 */
const captureProcess = {
	screen: {
		active: false,
		name: "Screen capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.screen.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-loglevel", "error",
				"-framerate", "60",
				"-video_size", "3024x1964",
				"-f", "avfoundation",
				"-pixel_format", "uyvy422",
				"-i", `${deviceList.video.indexOf("Capture screen 0")}:`,
				"-an",
				"-c:v", "h264_videotoolbox",
				"-b:v", "20000k",
				"-maxrate", "20000k",
				"-bufsize", "40000k",
				"-g", "0",
				"-f", "mpegts",
				"-pix_fmt", "yuv420p",
				`udp://${config.client.hostname}:5000`
			], { stdio: "inherit" });
		},
		process: null
	},
	microphone: {
		active: true,
		name: "Microphone capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.microphone.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-loglevel", "error",
				"-f", "avfoundation",
				"-i", `:${deviceList.audio.indexOf("Elgato Wave:3")}`,
				"-f", "mpegts",
				`udp://${config.client.hostname}:5001`
			], { stdio: "inherit" });
		},
		process: null
	},
	stream: {
		active: true,
		name: "Stream capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.stream.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-loglevel", "error",
				"-f", "avfoundation",
				"-i", `:${deviceList.audio.indexOf("BlackHole Stream")}`,
				"-f", "mpegts",
				`udp://${config.client.hostname}:5002`
			], { stdio: "inherit" });
		},
		process: null
	},
	music: {
		active: true,
		name: "Music capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.music.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-loglevel", "error",
				"-f", "avfoundation",
				"-i", `:${deviceList.audio.indexOf("BlackHole Musique")}`,
				"-f", "mpegts",
				`udp://${config.client.hostname}:5003`
			], { stdio: "inherit" });
		},
		process: null
	},
	monitoring: {
		active: true,
		name: "Monitoring capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.monitoring.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-loglevel", "error",
				"-f", "avfoundation",
				"-i", `:${deviceList.audio.indexOf("BlackHole Monitoring")}`,
				"-f", "mpegts",
				`udp://${config.client.hostname}:5004`
			], { stdio: "inherit" });
		},
		process: null
	}
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.app.get("/obs/settings/", (req, res) => {
		const { id } = req.query;
		const processId = id;

		if (!processId || !captureProcess[processId]) return res.status(400).send("Invalid or missing process ID");

		res.json({ id: processId, active: captureProcess[processId].active });
	});

	server.app.post("/obs/settings/", (req, res) => {
		let body = "";
		req.on("data", (chunk) => body += chunk.toString());

		req.on("end", async () => {
			try {
				const response = JSON.parse(body);
				const { id } = req.query;
				const { status } = response;

				if (!id || !captureProcess[id]) return res.status(400).send("Invalid or missing process ID");
				captureProcess[id].active = status;

				res.json({ id, active: captureProcess[id].active });
			} catch {
				res.status(400).send("Invalid status value");
			}
		});
	});
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const handler = async (logger, client, discord, server, config) => {
	updateDeviceList();

	for (const cp of Object.values(captureProcess)) {
		if (!cp.process || cp.process.killed) {
			if (cp.active) {
				cp.process = cp.spawn(logger, config);

				for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "uncaughtException", "unhandledRejection", "exit"]) {
					process.once(signal, async (reason, code) => {
						if (!cp.process.killed) {
							cp.process.removeAllListeners("exit");
							cp.process.kill(signal);
							await new Promise((callback) => process.once("exit", callback));
							process.exit(code);
						} else process.exit(code);
					});
				}
			}
		} else if (!cp.process.killed && !cp.active) cp.process.kill();
	}

	return true;
};

module.exports = {
	delay: 1 * 1000,
	init,
	process: handler
};