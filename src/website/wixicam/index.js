import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";
import * as THREE from "https://cdn.jsdelivr.net/npm/three/build/three.module.min.js";

const CAMERA_NAME = "Caméra du MacBook";
const SERVER_URL = "ws://localhost:1000/";
const FACE_DETECTION_FPS = 20;

let canvas, ctx;
let video, mediaSource, sourceBuffer;
let models = {};
let ws;
let lastDetect = 0;

const initCanvas = () => {
	canvas = document.querySelector("canvas");
	ctx = canvas.getContext("2d");

	const resize = () => {
		const ratio = 640 / 480;
		let width = window.innerWidth;
		let height = width / ratio;

		if (height > window.innerHeight) {
			height = window.innerHeight;
			width = height * ratio;
		}

		canvas.width = width * devicePixelRatio;
		canvas.height = height * devicePixelRatio;
	};

	video = document.querySelector("video");
	video.addEventListener("loadedmetadata", () => video.play());

	resize();
	window.addEventListener("resize", resize);
};

const connectCamera = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const cameraDevice = devices.find((d) => d.kind == "videoinput" && d.label.startsWith(CAMERA_NAME));

	if (!cameraDevice) {
		console.error("Camera device not found");
		setTimeout(connectCamera, 2000);
		return;
	}

	console.log("Using device:", cameraDevice.label);

	ws = new WebSocket(SERVER_URL);
	ws.binaryType = "arraybuffer";

	ws.addEventListener("open", () => ws.send(new Uint8Array([0x02])));
	ws.addEventListener("message", (event) => {
		if (new Uint8Array(event.data)[0] == 0x00) {
			console.log("Initializing media source...");

			mediaSource = new MediaSource();

			mediaSource.addEventListener("sourceopen", () => {
				console.log("Initializing source buffer...");

				sourceBuffer = mediaSource.addSourceBuffer(`video/mp4; codecs="avc1.42E01E"`);

				mediaSource.duration = Infinity;
				sourceBuffer.mode = "sequence";

				let queue = [];
				let updating = false;

				sourceBuffer.addEventListener("updateend", () => {
					updating = false;
					if (queue.length > 0) {
						updating = true;
						sourceBuffer.appendBuffer(queue.shift());
					}
				});

				ws.addEventListener("message", (event) => {
					const chunk = new Uint8Array(event.data);
					if (updating || sourceBuffer.updating || mediaSource.readyState != "open") queue.push(chunk);
					else {
						updating = true;
						sourceBuffer.appendBuffer(chunk);
					}
				});

				ws.send(cameraDevice.label);
			});

			video.src = URL.createObjectURL(mediaSource);
		} else console.error("Handshake failed:", data);
	}, { once: true });

	ws.addEventListener("close", reconnect);
};

const drawLoop = async () => {
	if (video.readyState >= 2) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

		const now = performance.now();
		if (now - lastDetect >= 1000 / FACE_DETECTION_FPS) {
			lastDetect = now;
			if (!models.faceLandmarker) return;

			try {
				models.faceLandmarker.result = await models.faceLandmarker.detectForVideo(video, performance.now());
			} catch (e) {
				console.warn("Face detection error:", e);
			}
		}

		const scale = Math.min(canvas.width, canvas.height) / 500 * devicePixelRatio;

		for (let i = 0; i < Math.min(
			models.faceLandmarker.result.faceLandmarks.length,
			models.faceLandmarker.result.faceBlendshapes.length,
			models.faceLandmarker.result.facialTransformationMatrixes.length
		); i++) {
			const face = {
				landmarks: models.faceLandmarker.result.faceLandmarks[i],
				blendShapes: models.faceLandmarker.result.faceBlendshapes[i],
				matrix: models.faceLandmarker.result.facialTransformationMatrixes[i]
			};

			ctx.fillStyle = "lime";
			for (const landmark of face.landmarks) {
				const x = canvas.width - (landmark.x * canvas.width);
				const y = landmark.y * canvas.height;
				ctx.fillRect(x - scale, y - scale, scale, scale);
			}

			const expressions = [];
			const blinkLeft = face.blendShapes.categories[9].score;
			const blinkRight = face.blendShapes.categories[10].score;
			const smile = (face.blendShapes.categories[44].score + face.blendShapes.categories[45].score) / 2;
			const browDown = (face.blendShapes.categories[1].score + face.blendShapes.categories[2].score) / 2;
			const browUp = face.blendShapes.categories[3].score;

			if (blinkLeft > 0.4) expressions.push("Left eye closed");
			if (blinkRight > 0.35) expressions.push("Right eye closed");
			if (smile > 0.5) expressions.push("Joy");
			else if (browUp > 0.1) expressions.push("Surprise");
			else if (browDown > 0.3) expressions.push("Angry");
			else if (browDown > 0.1) expressions.push("Perplex");

			const m = face.matrix.data;
			const rotX = Math.atan2(m[9], m[10]);
			const rotY = Math.atan2(-m[8], Math.sqrt(m[9] * m[9] + m[10] * m[10]));
			const rotZ = Math.atan2(m[4], m[0]);

			expressions.push(`Rot X: ${rotX.toFixed(2)}`, `Rot Y: ${rotY.toFixed(2)}`, `Rot Z: ${rotZ.toFixed(2)}`);

			ctx.fillStyle = "white";
			ctx.font = `${14 * scale}px Arial`;
			ctx.fillText(expressions.join(" · "), 0, 20 * scale);
		}
	};

	video.requestVideoFrameCallback(drawLoop);
};

const reconnect = async () => {
	await new Promise((resolve) => setTimeout(resolve, 2000));
	connectCamera();
};

const initModels = async () => {
	try {
		const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");

		models.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
				delegate: "CPU"
			},
			runningMode: "VIDEO",
			outputFaceBlendshapes: true,
			outputFacialTransformationMatrixes: true
		});
	} catch (e) {
		console.error("Model initialization failed:", e);
		setTimeout(initModels, 3000);
	}
};

addEventListener("DOMContentLoaded", async () => {
	initCanvas();
	connectCamera();
	initModels();
	drawLoop();
});