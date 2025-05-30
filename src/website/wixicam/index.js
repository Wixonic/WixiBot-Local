import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";
import * as THREE from "https://cdn.jsdelivr.net/npm/three/build/three.module.min.js";

const CAMERA_NAME = "Caméra du MacBook";
const SERVER_URL = "ws://localhost:1000/";
const FACE_DETECTION_FPS = 10;

let decoder;
let hasKeyFrame = false;
let canvas, ctx;
let models = {};
let ws;
let lastFrameTime = 0;
let animationId;

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

		canvas.width = width;
		canvas.height = height;
	};

	resize();
	window.addEventListener("resize", resize);
};

const connectCamera = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const cameraDevice = devices.find((d) => d.kind === "videoinput" && d.label.includes(CAMERA_NAME));

	if (!cameraDevice) {
		console.error("Camera not found");
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return connectCamera();
	}

	ws = new WebSocket(SERVER_URL);
	ws.binaryType = "arraybuffer";

	ws.addEventListener("open", () => ws.send(new Uint8Array([0x02])));

	ws.addEventListener("message", (event) => {
		if (new Uint8Array(event.data)[0] == 0x00) {
			ws.send(cameraDevice.label);

			ws.addEventListener("message", (event) => {
				if (!decoder || decoder.state == "closed") initDecoder();

				const data = new Uint8Array(event.data);

				let isKeyFrame = false;
				for (let i = 0; i < Math.min(data.length, 20); i++) {
					if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) {
						const nalType = data[i + 4] & 0x1F;
						if (nalType === 5) {
							isKeyFrame = true;
							break;
						}
					}
				}

				if (isKeyFrame) hasKeyFrame = true;
				if (!hasKeyFrame) return;

				try {
					decoder.decode(new EncodedVideoChunk({
						type,
						timestamp: performance.now(),
						data
					}));
				} catch (e) {
					console.error("Decode error:", e);
					initDecoder();
				}
			});
		} else console.error(event.data);
	}, { once: true });
	ws.addEventListener("close", reconnect);
	ws.addEventListener("error", reconnect);
};

const initDecoder = () => {
	hasKeyFrame = false;
	decoder = new VideoDecoder({
		output: drawFrame,
		error: (e) => {
			console.error("Decoder error:", e);
			setTimeout(initDecoder, 100);
		}
	});

	decoder.configure({
		codec: "avc1.42001E",
		codedWidth: 640,
		codedHeight: 480,
		optimizeForLatency: true
	});
};

const drawFrame = async (frame) => {
	const now = performance.now();

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
	frame.close();

	if (now - lastFrameTime >= 1000 / FACE_DETECTION_FPS) {
		lastFrameTime = now;
		detectFaces();
	}
};

const detectFaces = async () => {
	if (!models.faceLandmarker) return;

	try {
		const result = await models.faceLandmarker.detect(canvas, performance.now());
		renderFaceResults(result);
	} catch (e) {
		console.warn("Face detection error:", e);
	}
};

const renderFaceResults = (result) => {
	const scale = Math.min(canvas.width, canvas.height) / 500;

	for (let i = 0; i < Math.min(
		result.faceLandmarks.length,
		result.faceBlendshapes.length,
		result.facialTransformationMatrixes.length
	); i++) {
		const face = {
			landmarks: result.faceLandmarks[i],
			blendShapes: result.faceBlendshapes[i],
			matrix: result.facialTransformationMatrixes[i]
		};

		ctx.fillStyle = "lime";
		for (const landmark of face.landmarks) {
			const x = landmark.x * canvas.width;
			const y = landmark.y * canvas.height;
			ctx.fillRect(x - 1, y - 1, 2, 2);
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
		ctx.fillText(expressions.join(" · "), 10, 20);
	}
};

const reconnect = async () => {
	cancelAnimationFrame(animationId);
	if (decoder) {
		await decoder.flush();
		decoder.close();
	}

	await new Promise(r => setTimeout(r, 1000));
	connectCamera();
};

const initModels = async () => {
	try {
		const vision = await FilesetResolver.forVisionTasks(
			"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
		);

		models.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
				delegate: "GPU"
			},
			runningMode: "IMAGE",
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
});