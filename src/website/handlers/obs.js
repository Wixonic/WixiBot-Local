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
 * @type {{[name: string]: {spawn: (logger: import("@wixonic/logger").Logger, settings: import("../../types.d.ts").Settings) => childProcess.ChildProcess, process: childProcess.ChildProcess?, active: boolean, name: string}}}
 */
const captureProcess = {
	audio: {
		active: false,
		name: "Audio capture",
		spawn: (logger, settings) => {
			logger.info("Starting process:", captureProcess.audio.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",

				"-flags", "low_delay",
				"-fflags", "nobuffer",

				"-f", "avfoundation",
				"-framerate", "60",
				"-i", `:${deviceList.audio.indexOf("BlackHole")}`,

				"-c:a", "aac",
				"-b:a", "320k",
				"-ac", "2",
				"-ar", "48000",
				"-af", "volume=0.5",

				"-tune", "zerolatency",

				"-flush_packets", "1",
				"-muxdelay", "0",
				"-muxpreload", "0",
				"-f", "mpegts",
				"udp://10.0.0.1:2000"
			], { stdio: "inherit" });
		},
		process: null
	},
	screenshare1: {
		active: false,
		name: "Screen capture 1",
		spawn: (logger, settings) => {
			logger.info("Starting process:", captureProcess.screenshare1.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",

				"-flags", "low_delay",
				"-fflags", "nobuffer",

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

				"-flush_packets", "1",
				"-muxdelay", "0",
				"-muxpreload", "0",
				"-f", "mpegts",
				"udp://10.0.0.1:2001"
			], { stdio: "inherit" });
		},
		process: null
	},
	screenshare2: {
		active: false,
		name: "Screen capture 2",
		spawn: (logger, settings) => {
			logger.info("Starting process:", captureProcess.screenshare2.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",

				"-flags", "low_delay",
				"-fflags", "nobuffer",

				"-f", "avfoundation",
				"-capture_cursor", "1",
				"-framerate", "60",
				"-video_size", "3840x2160",
				"-pixel_format", "uyvy422",
				"-i", `${deviceList.video.indexOf("Capture screen 1")}:`,

				"-c:v", "h264_videotoolbox",
				"-preset", "ultrafast",
				"-profile:v", "high",
				"-b:v", "16M",
				"-realtime", "1",
				"-g", "30",

				"-flush_packets", "1",
				"-muxdelay", "0",
				"-muxpreload", "0",
				"-f", "mpegts",
				"udp://10.0.0.1:2001"
			], { stdio: "inherit" });
		},
		process: null
	},
	camera: {
		active: false,
		name: "Camera capture",
		spawn: (logger, settings) => {
			logger.info("Starting process:", captureProcess.camera.name);
			return childProcess.spawn("/usr/local/ffmpeg-4.1/bin/ffmpeg", [
				"-hide_banner",
				"-loglevel", "warning",

				"-fflags", "nobuffer+genpts",
				"-flags", "low_delay",

				"-probesize", "32M",
				"-analyzeduration", "30M",

				"-f", "avfoundation",
				"-framerate", "30",
				"-video_size", "1280x720",
				"-pixel_format", "uyvy422",
				"-i", `${deviceList.video.findIndex((value) => value.startsWith("Caméra du "))}:`,

				"-vf", "format=yuv420p,scale=1280:720",

				"-an",
				"-c:v", "libx264",
				"-preset", "ultrafast",
				"-tune", "zerolatency",
				"-crf", "25",
				"-profile:v", "baseline",
				"-level", "4.1",
				"-g", "60",
				"-keyint_min", "60",

				"-use_wallclock_as_timestamps", "1",
				"-vsync", "1",

				"-x264-params", "repeat-headers=1:scenecut=0:force-cfr=1:nal-hrd=cbr",

				"-f", "mpegts",
				"udp://10.0.0.1:2002"
			], { stdio: "inherit" });
		},
		process: null
	},
	microphone: {
		active: false,
		name: "Microphone streaming",
		spawn: (logger, settings) => {
			logger.info("Starting process:", captureProcess.microphone.name);
			return childProcess.spawn("ffplay", [
				"-hide_banner",
				"-loglevel", "warning",

				"-flags", "low_delay",
				"-fflags", "nobuffer",

				"-nodisp",
				"-vn",

				"-f", "mpegts",
				"udp://10.0.0.1:2003"
			], { stdio: "inherit" });
		},
		process: null
	},
	broadcast: {
		active: false,
		name: "Broadcast",
		spawn: (logger, settings) => {
			logger.info("Starting process:", captureProcess.broadcast.name);
			return null;
		},
		process: null
	}
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
		delay: 2 * 1000,
		process: (logger, settings) => {
			updateDeviceList();

			for (const cp of Object.values(captureProcess)) {
				if (!cp.process || cp.process.killed) {
					if (cp.active) {
						cp.process = cp.spawn(logger, settings);

						for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "uncaughtException", "unhandledRejection", "exit"]) {
							process.once(signal, async (reason, code) => {
								if (!cp.process.killed) {
									cp.process.removeAllListeners("exit");
									cp.process.kill("SIGTERM");
								}
							});
						}
					}
				} else if (!cp.process.killed && !cp.active) cp.process.kill("SIGTERM");
			}

			return false;
		}
	}
};

module.exports = info;