const childProcess = require("child_process");

/**
 * @type {{audio: string[], video: string[]}}
 */
const deviceList = {
	audio: [],
	video: []
};

const target = "10.0.0.1";

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
	audio: {
		active: true,
		name: "Audio capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.audio.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",
				"-f", "avfoundation",
				"-framerate", "60",
				"-i", `:${deviceList.audio.indexOf("BlackHole")}`,

				"-filter_complex", "volume=0.5",
				"-c:a", "aac",
				"-b:a", "320k",
				"-ac", "2",
				"-ar", "48000",

				"-flags", "low_delay",
				"-fflags", "nobuffer",
				"-flush_packets", "1",
				"-muxdelay", "0",
				"-muxpreload", "0",
				"-f", "mpegts",
				`udp://${target}:2000`
			], { stdio: "inherit" });
		},
		process: null
	},
	screenshare: {
		active: false,
		name: "Screen capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.screenshare.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",
				"-f", "avfoundation",
				"-capture_cursor", "1",
				"-framerate", "60",
				"-video_size", "3024x1964",
				"-pixel_format", "uyvy422",
				"-i", `${deviceList.video.indexOf("Capture screen 0")}:`,

				"-c:v", "h264_videotoolbox",
				"-preset", "ultrafast",
				"-profile:v", "high",
				"-b:v", "16M",
				"-realtime", "1",
				"-g", "30",

				"-flags", "low_delay",
				"-fflags", "nobuffer",
				"-flush_packets", "1",
				"-muxdelay", "0",
				"-muxpreload", "0",
				"-f", "mpegts",
				`udp://${target}:2001`
			], { stdio: "inherit" });
		},
		process: null
	},
	camera: {
		active: false,
		name: "Camera capture",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.camera.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",
				"-f", "avfoundation",
				"-framerate", "30",
				"-video_size", "1920x1080",
				"-pixel_format", "uyvy422",
				"-i", `${deviceList.video.findIndex((value) => value.startsWith("Caméra du "))}:`,

				"-flags", "low_delay",
				"-fflags", "nobuffer",
				"-flush_packets", "1",
				"-muxdelay", "0",
				"-muxpreload", "0",
				"-f", "mpegts",
				`udp://${target}:2002`
			], { stdio: "inherit" });
		},
		process: null
	},
	microphone: {
		active: false,
		name: "Microphone streaming",
		spawn: (logger, config) => {
			logger.info("Starting process:", captureProcess.microphone.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",
				"-f", "mpegts",
				"-i", "udp://@:2003",

				"-f", "coreaudio",
				`:${deviceList.audio.indexOf("BlackHole")}`,
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
						}
					});
				}
			}
		} else if (!cp.process.killed && !cp.active) cp.process.kill("SIGTERM");
	}

	return true;
};

module.exports = {
	delay: 1 * 1000,
	init,
	process: handler
};