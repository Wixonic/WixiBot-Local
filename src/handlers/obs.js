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
	const result = childProcess.spawnSync("ffmpeg", [
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
		active: true,
		name: "Screen capture",
		spawn: (logger, config) => {
			if (captureProcess.screen.active) {
				logger.info("Starting process:", captureProcess.screen.name);
				return childProcess.spawn("ffmpeg", [
					"-loglevel", "error",
					"-framerate", "60",
					"-video_size", "3024x1964",
					"-f", "avfoundation",
					"-pixel_format", "uyvy422",
					"-i", `${deviceList.video.indexOf("Capture screen 0")}:none`,
					"-c:v", "h264_videotoolbox",
					"-b:v", "6000k",
					"-f", "mpegts",
					`udp://${config.client.hostname}:5000`
				], { stdio: "inherit" });
			} else return null;
		},
		process: null
	},
	microphone: {
		active: true,
		name: "Monitoring capture",
		spawn: (logger, config) => {
			if (captureProcess.monitoring.active) {
				logger.info("Starting process:", captureProcess.monitoring.name);
				return childProcess.spawn("ffmpeg", [
					"-loglevel", "error",
					"-f", "avfoundation",
					"-i", `:${deviceList.audio.indexOf("Elgato Wave:3")}`,
					"-f", "mpegts",
					`udp://${config.client.hostname}:5001`
				], { stdio: "inherit" });
			} else return null;
		},
		process: null
	},
	stream: {
		active: true,
		name: "Monitoring capture",
		spawn: (logger, config) => {
			if (captureProcess.monitoring.active) {
				logger.info("Starting process:", captureProcess.monitoring.name);
				return childProcess.spawn("ffmpeg", [
					"-loglevel", "error",
					"-f", "avfoundation",
					"-i", `:${deviceList.audio.indexOf("BlackHole Stream")}`,
					"-f", "mpegts",
					`udp://${config.client.hostname}:5002`
				], { stdio: "inherit" });
			} else return null;
		},
		process: null
	},
	music: {
		active: true,
		name: "Monitoring capture",
		spawn: (logger, config) => {
			if (captureProcess.monitoring.active) {
				logger.info("Starting process:", captureProcess.monitoring.name);
				return childProcess.spawn("ffmpeg", [
					"-loglevel", "error",
					"-f", "avfoundation",
					"-i", `:${deviceList.audio.indexOf("BlackHole Musique")}`,
					"-f", "mpegts",
					`udp://${config.client.hostname}:5003`
				], { stdio: "inherit" });
			} else return null;
		},
		process: null
	},
	monitoring: {
		active: true,
		name: "Monitoring capture",
		spawn: (logger, config) => {
			if (captureProcess.monitoring.active) {
				logger.info("Starting process:", captureProcess.monitoring.name);
				return childProcess.spawn("ffmpeg", [
					"-loglevel", "error",
					"-f", "avfoundation",
					"-i", `:${deviceList.audio.indexOf("BlackHole Monitoring")}`,
					"-f", "mpegts",
					`udp://${config.client.hostname}:5004`
				], { stdio: "inherit" });
			} else return null;
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
const handler = async (logger, client, discord, server, config) => {
	updateDeviceList();

	for (const process of Object.values(captureProcess)) {
		if (!process.process || process.process.killed) process.process = process.spawn(logger, config);
	}

	return true;
};

module.exports = {
	delay: 1 * 1000,
	process: handler
};