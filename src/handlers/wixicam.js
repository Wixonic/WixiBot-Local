const { spawn, spawnSync } = require("child_process");

let deviceMap = new Map();
let cameraProcesses = new Map();

const updateDeviceList = () => {
	const result = spawnSync("ffmpeg", [
		"-f", "avfoundation",
		"-list_devices", "true",
		"-i", ""
	], { encoding: "utf8" });

	deviceMap.clear();
	result.stderr.split("\n").forEach(line => {
		const match = line.match(/\[AVFoundation input device @ .*\]\s*\[(\d+)\]\s*(.*)/);
		if (match) deviceMap.set(match[2].trim(), match[1]);
	});
};

const captureCamera = (cameraIndex) => spawn("ffmpeg", [
	"-loglevel", "error",
	"-flags", "low_delay",
	"-f", "avfoundation",
	"-pix_fmt", "nv12",
	"-framerate", "30",
	"-video_size", "640x480",
	"-i", `${cameraIndex}:none`,
	"-vcodec", "libx264",
	"-preset", "ultrafast",
	"-tune", "zerolatency",
	"-pix_fmt", "yuv420p",
	"-g", "30",
	"-sc_threshold", "0",
	"-bsf:v", "h264_mp4toannexb",
	"-f", "h264",
	"pipe:1"
]);

/**
 * @param {import("@wixonic/logger").Logger} logger
 * @param {import("../lib/client.js")} client
 * @param {import("../lib/discord.js")} discord
 * @param {import("../lib/server.js")} server
 * @param {import("../types.d.ts").Config} config
 */
const init = async (logger, client, discord, server, config) => {
	server.ws.on("connection", (ws) => {
		let cameraName = null;
		let cameraKey = null;

		const cleanup = () => {
			if (!cameraKey) return;
			const procData = cameraProcesses.get(cameraKey);
			if (!procData) return;

			procData.clients.delete(ws);
			if (procData.clients.size === 0) {
				procData.process.kill("SIGINT");
				cameraProcesses.delete(cameraKey);
				logger.debug(`Camera process killed for ${cameraKey}`);
			}
		};

		ws.once("message", (data) => {
			if (data[0] == 0x02) {
				ws.send(Buffer.from([0x00]));

				ws.once("message", (nameData) => {
					updateDeviceList();

					cameraName = nameData.toString();
					const cameraIndex = deviceMap.get(cameraName) || "0";
					cameraKey = `${cameraName}|${cameraIndex}`;

					logger.info("Starting stream with camera:", cameraName);

					let procData = cameraProcesses.get(cameraKey);
					if (!procData) {
						const process = captureCamera(cameraIndex);
						procData = {
							process,
							clients: new Set()
						};
						cameraProcesses.set(cameraKey, procData);

						process.stdout.on("data", (frame) => {
							for (const client of procData.clients) {
								if (client.readyState === 1) {
									client.send(frame);
								}
							}
						});

						process.stderr.on("data", (error) => {
							logger.warn(`FFMPEG: ${String(error).trim()}`);
						});

						process.on("error", (err) => {
							logger.error(`FFMPEG error: ${err.message}`);
						});

						process.on("exit", () => {
							cameraProcesses.delete(cameraKey);
						});
					}

					procData.clients.add(ws);
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