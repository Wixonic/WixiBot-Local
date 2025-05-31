const { spawn, spawnSync } = require("child_process");

let deviceList = [];
let cameraProcess = null;

const trimCameraName = (name) => name.split("(")[0].replace(/\s\n\t/, " ").trim();

const updateDeviceList = () => {
	const result = spawnSync("ffmpeg", [
		"-f", "avfoundation",
		"-list_devices", "true",
		"-i", ""
	], { encoding: "utf8", stderr: "pipe" });

	deviceList = [];
	const output = result.stderr || result.stdout;

	for (const match of output.split("AVFoundation audio devices")[0].matchAll(/\.*\] \[(\d+)\] (.+)/g)) deviceList[Number(match[1])] = trimCameraName(match[2]);
};

const captureCamera = (cameraIndex) => {
	cameraProcess = spawn("/opt/homebrew/bin/ffmpeg", [
		"-loglevel", "error",
		"-fflags", "nobuffer",
		"-flags", "low_delay",
		"-strict", "-2",
		"-f", "avfoundation",
		"-framerate", "30",
		"-video_size", "1280x720",
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
				cameraProcess.kill("SIGKILL");
				cameraProcess = null;
				logger.debug("Camera process killed");
			}
		};

		ws.once("message", (data) => {
			if (data[0] == 0x02) {
				ws.send(Buffer.from([0x00]));

				ws.once("message", (nameData) => {
					updateDeviceList();

					const cameraName = trimCameraName(nameData.toString());

					let cameraIndex = 0;
					for (const id in deviceList) {
						const name = deviceList[id];

						if (name == cameraName) {
							cameraIndex = id;
							break;
						}
					}

					cleanup();
					logger.info("Starting stream with camera:", deviceList[cameraIndex] ?? "unknown");
					captureCamera(cameraIndex);
					cameraProcess.stdout.on("data", (frame) => ws.send(frame));
					cameraProcess.stderr.on("data", (e) => logger.warn(`ffmpeg: ${String(e).trim()}`));
					cameraProcess.on("error", (e) => logger.error(`ffmpeg error: ${e.message}`));
					cameraProcess.on("exit", () => cleanup());
				});

				ws.on("error", (e) => {
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