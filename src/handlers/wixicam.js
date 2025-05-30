const { spawn, spawnSync } = require("child_process");

let deviceMap = new Map();
let cameraProcess = null;

const updateDeviceList = () => {
	const result = spawnSync("ffmpeg", [
		"-f", "avfoundation",
		"-list_devices", "true",
		"-i", ""
	], { encoding: "utf8", stderr: "pipe" });

	deviceMap.clear();
	const output = result.stderr || result.stdout;
	output.split("\n").forEach((line) => {
		const match = line.match(/\.*\] \[(\d+)\] (.+)/);
		if (match) deviceMap.set(match[2].trim(), match[1]);
	});
};

const captureCamera = (cameraIndex) => {
	cameraProcess = spawn("ffmpeg", [
		"-loglevel", "error",
		"-fflags", "nobuffer",
		"-flags", "low_delay",
		"-strict", "-2",
		"-f", "avfoundation",
		"-framerate", "30",
		"-video_size", "640x480",
		"-pix_fmt", "uyvy422",
		"-i", `${cameraIndex}:none`,
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-g", "1",
		"-keyint_min", "1",
		"-sc_threshold", "0",
		"-c:v", "libx264",
		"-profile:v", "baseline",
		"-level", "3.0",
		"-pix_fmt", "yuv420p",
		"-f", "mp4",
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"pipe:1"
	]);
};

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.ws.on("connection", (ws) => {
		const cleanup = () => {
			if (cameraProcess) {
				cameraProcess.kill("SIGINT");
				cameraProcess = null;
				logger.debug("Camera process killed");
			}
		};

		ws.once("message", (data) => {
			if (data[0] == 0x02) {
				ws.send(Buffer.from([0x00]));

				ws.once("message", (nameData) => {
					updateDeviceList();

					cameraName = nameData.toString();
					const cameraIndex = deviceMap.get(cameraName) || "0";

					logger.info("Starting stream with camera:", cameraName);

					captureCamera(cameraIndex);
					cameraProcess.stdout.on("data", (frame) => ws.send(frame));
					cameraProcess.stderr.on("data", (error) => logger.warn(`FFMPEG: ${String(error).trim()}`));
					cameraProcess.on("error", (err) => logger.error(`FFMPEG error: ${err.message}`));
					cameraProcess.on("exit", () => cameraProcess = null);
				});

				ws.on("error", (err) => {
					logger.warn(`WebSocket error: ${err.message}`);
					cleanup();
				});

				ws.on("close", () => {
					cleanup();
					logger.debug("WebSocket closed");
				});
			}
		});
	});
};

module.exports = {
	init
};